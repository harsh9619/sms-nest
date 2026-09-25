import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  NotFoundException,
  Inject,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { FeeService } from "./fee.service.js";
import { toIntID } from "../../db/index.js";

@Controller(["api/fees", "api/:schoolId/fees"])
export class FeeController {
  constructor(@Inject(FeeService) private readonly feeService: FeeService) { }

  @Get()
  async getFees(
    @Param("schoolId") schoolIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string,
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("feeType") feeType?: string,
    @Query("month") month?: string,
    @Query("studentId") studentIdStr?: string,
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const studentId = studentIdStr ? toIntID(studentIdStr) : undefined;

    return this.feeService.getFees({
      schoolId,
      academicYearHeader,
      page,
      limit,
      search,
      status,
      feeType,
      month,
      studentId,
    });
  }

  @Post()
  async createFee(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const studentId = toIntID(String(body.studentId));

    const result = await this.feeService.createFee(schoolId, {
      ...body,
      studentId,
    });

    return result;
  }

  @Put(":id")
  async updateFee(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const feeId = toIntID(idStr);
    const existing = await this.feeService.getFeeById(feeId);
    if (!existing) {
      throw new NotFoundException("Fee record not found");
    }

    const { amount, feeType, remarks, dueDate, month, status, paidDate, paymentMethod } = body;

    await this.feeService.updateFee(feeId, {
      amount,
      feeType,
      remarks,
      dueDate,
      month,
      status,
      paidDate,
      paymentMethod,
    });

    return this.feeService.getFullFeeRecord(feeId);
  }

  @Delete(":id")
  async deleteFee(@Param("id") idStr: string) {
    const feeId = toIntID(idStr);
    const existing = await this.feeService.getFullFeeRecord(feeId);
    if (!existing) {
      throw new NotFoundException("Not found");
    }

    await this.feeService.deleteFee(feeId);
    return existing;
  }

  // --- Class Fee Structures Endpoints ---

  @Get("structures/all")
  async getClassFeeStructures(
    @Param("schoolId") schoolIdStr: string,
    @Query("classMasterId") classMasterIdStr?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const classMasterId = classMasterIdStr ? toIntID(classMasterIdStr) : undefined;
    return this.feeService.getClassFeeStructures(schoolId, classMasterId);
  }

  @Post("structures")
  async createOrUpdateClassFeeStructure(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const structId = await this.feeService.createOrUpdateClassFeeStructure(schoolId, body);
    return { success: true, id: structId };
  }

  @Delete("structures/:id")
  async deleteClassFeeStructure(@Param("id") idStr: string) {
    const id = toIntID(idStr);
    await this.feeService.deleteClassFeeStructure(id);
    return { success: true, message: "Class fee structure component deleted" };
  }

  @Post("generate-invoices")
  async generateInvoices(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { classMasterId: string | number; dueDate?: string; month?: string },
    @Headers("academicyearid") academicYearHeader?: string,
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const classMasterId = toIntID(String(body.classMasterId));
    return this.feeService.generateInvoicesFromClassStructure(schoolId, classMasterId, body.dueDate, body.month, academicYearHeader);
  }

  @Post("pay-bundle")
  async payFeeBundle(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: {
      studentId: string | number;
      feeIds: (string | number)[];
      paymentMethod?: string;
      paidDate?: string;
      remarks?: string;
    }
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 0;
    const studentId = toIntID(String(body.studentId));
    const feeIds = (body.feeIds || []).map((id) => toIntID(String(id)));

    return this.feeService.payFeeBundle(schoolId, {
      studentId,
      feeIds,
      paymentMethod: body.paymentMethod,
      paidDate: body.paidDate,
      remarks: body.remarks,
    });
  }

  @Get("receipts/:receiptNumber")
  async getReceiptByNumber(@Param("receiptNumber") receiptNumber: string) {
    const receipt = await this.feeService.getReceiptByNumber(receiptNumber);
    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptNumber} not found`);
    }
    return receipt;
  }

  @Get("receipts/:receiptNumber/pdf")
  async downloadReceiptPdfByNumber(
    @Param("receiptNumber") receiptNumber: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.feeService.generateReceiptPdfByNumber(receiptNumber);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fee-receipt-${receiptNumber}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Get(":id/download-pdf")
  async downloadFeeReceiptPdf(@Param("id") idStr: string, @Res() res: Response) {
    const feeId = toIntID(idStr);
    const pdfBuffer = await this.feeService.generateFeeReceiptPdf(feeId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fee-receipt-${feeId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Get("monthly-receipt-pdf")
  async downloadMonthlyFeeReceiptPdf(
    @Query("studentId") studentIdStr: string,
    @Query("month") month: string,
    @Res() res: Response
  ) {
    const studentId = toIntID(studentIdStr);
    const pdfBuffer = await this.feeService.generateMonthlyFeeReceiptPdf(studentId, month);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="monthly-fee-receipt-${month}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
