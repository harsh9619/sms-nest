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
import { FeeService } from "./fee.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/fees")
export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  @Get()
  async getFees(
    @Param("schoolId") schoolIdStr: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.feeService.getFees(schoolId, academicYear);
  }

  @Post()
  async createFee(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { studentId, amount, feeType, dueDate, paidDate, status, remarks } = body;
    const dbStudentId = toIntID(String(studentId));

    const newFeeId = await this.feeService.createFee(schoolId, {
      studentId: dbStudentId,
      amount,
      feeType,
      dueDate,
      paidDate,
      status,
      remarks,
    });

    return this.feeService.getFullFeeRecord(newFeeId);
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

    const { amount, feeType, remarks, dueDate, status, paidDate } = body;

    await this.feeService.updateFee(feeId, {
      amount,
      feeType,
      remarks,
      dueDate,
      status,
      paidDate,
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
}
