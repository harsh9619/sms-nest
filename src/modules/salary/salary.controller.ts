import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  Res,
  Headers,
} from "@nestjs/common";
import type { Response } from "express";
import { SalaryService } from "./salary.service.js";
import { toIntID } from "../../db/index.js";

@Controller(["api/salaries", "api/:schoolId/salaries"])
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get()
  async getSalaries(
    @Param("schoolId") schoolIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string,
    @Query("academicYear") academicYear?: string,
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("teacherId") teacherIdStr?: string,
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const teacherId = teacherIdStr ? toIntID(teacherIdStr) : undefined;

    return this.salaryService.getSalaries({
      schoolId,
      academicYearHeader,
      academicYear,
      page,
      limit,
      search,
      status,
      teacherId,
    });
  }

  @Post()
  async createSalary(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const rawSchoolId = schoolIdStr || body.schoolId || "1";
    const schoolId = toIntID(String(rawSchoolId));
    const { teacherId, baseSalary, allowances, deductions, month, year, status, paidDate } = body;
    const dbTeacherId = toIntID(String(teacherId || body.teacherId || "1"));

    const newRecordId = await this.salaryService.createSalary(schoolId, {
      teacherId: dbTeacherId,
      baseSalary,
      allowances,
      deductions,
      month,
      year,
      status,
      paidDate,
    });

    return this.salaryService.getFullSalaryRecord(newRecordId);
  }

  @Put(":id")
  async updateSalary(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const recordId = toIntID(idStr);
    const existing = await this.salaryService.getSalaryById(recordId);
    if (!existing) {
      throw new NotFoundException("Salary record not found");
    }

    const { baseSalary, allowances, deductions, month, year, status, paidDate } = body;

    await this.salaryService.updateSalary(recordId, {
      baseSalary,
      allowances,
      deductions,
      month,
      year,
      status,
      paidDate,
    });

    return this.salaryService.getFullSalaryRecord(recordId);
  }

  @Delete(":id")
  async deleteSalary(@Param("id") idStr: string) {
    const recordId = toIntID(idStr);
    const existing = await this.salaryService.getFullSalaryRecord(recordId);
    if (!existing) {
      throw new NotFoundException("Not found");
    }

    await this.salaryService.deleteSalary(recordId);
    return existing;
  }

  // --- Salary Structures Endpoints ---

  @Get("structures/all")
  async getSalaryStructures(
    @Param("schoolId") schoolIdStr: string,
    @Query("teacherId") teacherIdStr?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const teacherId = teacherIdStr ? toIntID(teacherIdStr) : undefined;
    return this.salaryService.getSalaryStructures(schoolId, teacherId);
  }

  @Post("structures")
  async createOrUpdateSalaryStructure(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const structId = await this.salaryService.createOrUpdateSalaryStructure(schoolId, body);
    return { success: true, id: structId };
  }

  @Delete("structures/:id")
  async deleteSalaryStructure(@Param("id") idStr: string) {
    const id = toIntID(idStr);
    await this.salaryService.deleteSalaryStructure(id);
    return { success: true, message: "Salary structure deleted" };
  }

  @Post("generate-payroll")
  async generatePayroll(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { month: number; year: number }
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    return this.salaryService.generateMonthlyPayroll(schoolId, Number(body.month), Number(body.year));
  }

  @Get(":id/download-pdf")
  async downloadSalarySlipPdf(@Param("id") idStr: string, @Res() res: Response) {
    const recordId = toIntID(idStr);
    const pdfBuffer = await this.salaryService.generateSalarySlipPdf(recordId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="salary-slip-${recordId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
