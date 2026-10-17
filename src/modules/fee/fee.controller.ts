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
  Req,
} from "@nestjs/common";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { FeeService } from "./fee.service.js";
import { toIntID } from "../../db/index.js";

@Controller(["api/fees", "api/:schoolId/fees"])
export class FeeController {
  constructor(@Inject(FeeService) private readonly feeService: FeeService) { }

  private extractCurrentUser(req: any): any {
    let user = req?.user;
    if (!user && req?.headers?.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.slice(7).trim();
        const jwtSecret = process.env.JWT_SECRET || "sms-jwt-secret";
        const verifyFn = jwt.verify || (jwt as any).default?.verify;
        user = verifyFn(token, jwtSecret);
      } catch (e) {
        // ignore decoding errors
      }
    }
    return user;
  }

  @Get()
  async getFees(
    @Req() req: any,
    @Param("schoolId") schoolIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string,
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("feeType") feeType?: string,
    @Query("month") month?: string,
    @Query("studentId") studentIdStr?: string,
    @Query("scheduleId") scheduleIdStr?: string,
    @Query("installmentName") installmentName?: string,
    @Query("sessionStart") sessionStart?: string,
    @Query("classMasterId") classMasterIdStr?: string,
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const studentId = studentIdStr ? toIntID(studentIdStr) : undefined;
    const scheduleId = scheduleIdStr ? toIntID(scheduleIdStr) : undefined;
    const classMasterId = classMasterIdStr ? toIntID(classMasterIdStr) : undefined;
    const currentUser = this.extractCurrentUser(req);

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
      scheduleId,
      installmentName,
      sessionStart,
      classMasterId,
      currentUser,
    });
  }

  // --- Fee Statistics Endpoint ---
  @Get("stats")
  async getFeeStats(
    @Req() req: any,
    @Param("schoolId") schoolIdStr: string
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    const currentUser = this.extractCurrentUser(req);
    return this.feeService.getFeeStats(schoolId, currentUser);
  }

  // --- School Fee Settings Endpoints ---
  @Get("settings")
  async getSchoolFeeSettings(@Param("schoolId") schoolIdStr: string) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    return this.feeService.getSchoolFeeSettings(schoolId);
  }

  @Put("settings")
  async updateSchoolFeeSettings(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { feeSessionStart?: string; feeFrequency?: string }
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    return this.feeService.updateSchoolFeeSettings(schoolId, body);
  }

  // --- Fee Payment Schedules Endpoints (Version 2) ---

  @Get("schedules")
  async getFeeSchedules(
    @Param("schoolId") schoolIdStr: string,
    @Query("sessionStart") sessionStart?: string,
    @Query("format") format?: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    return this.feeService.getFeeSchedules(schoolId, { sessionStart, format, academicYear });
  }

  @Get("schedules/:id")
  async getFeeScheduleById(@Param("id") idStr: string) {
    const id = toIntID(idStr);
    const item = await this.feeService.getFeeScheduleById(id);
    if (!item) {
      throw new NotFoundException("Schedule item not found");
    }
    return item;
  }

  @Post("schedules")
  async createOrUpdateFeeSchedule(
    @Headers("academicyearid") academicYearHeader: string,
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    const id = await this.feeService.createOrUpdateFeeScheduleItem(schoolId, academicYearHeader, body);
    return { success: true, id };
  }

  @Delete("schedules/:id")
  async deleteFeeSchedule(@Param("id") idStr: string) {
    const id = toIntID(idStr);
    await this.feeService.deleteFeeScheduleItem(id);
    return { success: true, message: "Schedule item deleted" };
  }

  @Post("schedules/generate-defaults")
  async generateDefaultSchedule(
    @Headers("academicyearid") academicYearHeader: string,
    @Param("schoolId") schoolIdStr: string,
    @Body()
    body: {
      sessionStart: "april" | "july";
      format: "monthly" | "quarterly";
      academicYear?: string;
      dueDay?: number;
    }
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    return this.feeService.generateSchoolDefaultSchedule(
      schoolId,
      body.sessionStart || "april",
      body.format || "monthly",
      body.academicYear,
      body.dueDay || 10,
      academicYearHeader,
    );
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
    @Body()
    body: {
      classMasterId?: string | number;
      dueDate?: string;
      month?: string;
      scheduleId?: number | string;
      installmentName?: string;
      sessionStart?: string;
      installmentFormat?: string;
      multiplier?: number;
      isEntireYear?: boolean;
    },
    @Headers("academicyearid") academicYearHeader?: string,
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    return this.feeService.generateInvoicesFromClassStructure(
      schoolId,
      body,
      body.dueDate,
      body.month,
      academicYearHeader
    );
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
  async getReceiptByNumber(
    @Req() req: any,
    @Param("receiptNumber") receiptNumber: string
  ) {
    const currentUser = this.extractCurrentUser(req);
    const receipt = await this.feeService.getReceiptByNumber(receiptNumber, currentUser);
    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptNumber} not found`);
    }
    return receipt;
  }

  @Get("receipts/:receiptNumber/pdf")
  async downloadReceiptPdfByNumber(
    @Req() req: any,
    @Param("receiptNumber") receiptNumber: string,
    @Res() res: Response
  ) {
    const currentUser = this.extractCurrentUser(req);
    const pdfBuffer = await this.feeService.generateReceiptPdfByNumber(receiptNumber, currentUser);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fee-receipt-${receiptNumber}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Get(":id/download-pdf")
  async downloadFeeReceiptPdf(
    @Req() req: any,
    @Param("id") idStr: string,
    @Res() res: Response
  ) {
    const feeId = toIntID(idStr);
    const currentUser = this.extractCurrentUser(req);
    const pdfBuffer = await this.feeService.generateFeeReceiptPdf(feeId, currentUser);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fee-receipt-${feeId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Get("monthly-receipt-pdf")
  async downloadMonthlyFeeReceiptPdf(
    @Req() req: any,
    @Query("studentId") studentIdStr: string,
    @Query("month") month: string,
    @Res() res: Response
  ) {
    const studentId = studentIdStr ? toIntID(studentIdStr) : 0;
    const currentUser = this.extractCurrentUser(req);
    const pdfBuffer = await this.feeService.generateMonthlyFeeReceiptPdf(studentId, month, currentUser);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="monthly-fee-receipt-${month}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
