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
} from "@nestjs/common";
import { SalaryService } from "./salary.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/salaries")
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get()
  async getSalaries(
    @Param("schoolId") schoolIdStr: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.salaryService.getSalaries(schoolId, academicYear);
  }

  @Post()
  async createSalary(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { teacherId, baseSalary, allowances, deductions, month, year, status, paidDate } = body;
    const dbTeacherId = toIntID(String(teacherId));

    const newSalaryId = await this.salaryService.createSalary(schoolId, {
      teacherId: dbTeacherId,
      baseSalary,
      allowances,
      deductions,
      month,
      year,
      status,
      paidDate,
    });

    return this.salaryService.getFullSalaryRecord(newSalaryId);
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

    const baseSalary = body.baseSalary !== undefined ? body.baseSalary : Number(existing.basic_salary);
    const allowances = body.allowances !== undefined ? body.allowances : Number(existing.other_allowances);
    const deductions = body.deductions !== undefined ? body.deductions : Number(existing.other_deductions);
    const month = body.month !== undefined ? body.month : existing.month;
    const year = body.year !== undefined ? body.year : existing.year;
    const status = body.status !== undefined ? body.status : existing.status;
    const paidDate = body.paidDate !== undefined ? body.paidDate : existing.paid_at;

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
}
