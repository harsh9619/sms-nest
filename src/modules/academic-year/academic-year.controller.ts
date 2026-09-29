import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { AcademicYearService } from "./academic-year.service.js";
import { toIntID } from "../../db/index.js";

@Controller(["api/academic-years", "api/:schoolId/academic-years"])
export class AcademicYearController {
  constructor(private readonly ayService: AcademicYearService) {}

  @Get("master")
  async getMasterAcademicYears() {
    return this.ayService.getMasterAcademicYears();
  }

  @Get()
  async getAcademicYears(@Param("schoolId") schoolIdStr?: string) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    if (!schoolId) {
      return this.ayService.getMasterAcademicYears();
    }
    return this.ayService.getAcademicYears(schoolId);
  }

  @Get("current")
  async getCurrentAcademicYear(@Param("schoolId") schoolIdStr: string) {
    const schoolId = toIntID(String(schoolIdStr));
    const year = await this.ayService.getCurrentAcademicYear(schoolId);

    if (!year) {
      throw new NotFoundException("No current academic year set for this school.");
    }
    return year;
  }

  @Post()
  async createAcademicYear(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { label, startDate, endDate, isCurrent } = body;

    if (!label || !startDate || !endDate) {
      throw new BadRequestException("label, startDate, and endDate are required.");
    }

    try {
      return await this.ayService.createAcademicYear(schoolId, {
        label,
        startDate,
        endDate,
        isCurrent: !!isCurrent,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException(
          "An academic year with this label already exists for this school."
        );
      }
      throw err;
    }
  }

  @Put(":id")
  async updateAcademicYear(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const id = toIntID(idStr);
    const existing = await this.ayService.getAcademicYearById(id);
    if (!existing) {
      throw new NotFoundException("Academic year not found.");
    }
    const schoolId = toIntID(existing.schoolId);

    const { label, startDate, endDate, isCurrent } = body;
    if (!label || !startDate || !endDate) {
      throw new BadRequestException("label, startDate, and endDate are required.");
    }

    try {
      return await this.ayService.updateAcademicYear(id, schoolId, {
        label,
        startDate,
        endDate,
        isCurrent: !!isCurrent,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException(
          "An academic year with this label already exists for this school."
        );
      }
      throw err;
    }
  }

  @Delete(":id")
  async deleteAcademicYear(@Param("id") idStr: string) {
    const id = toIntID(idStr);
    const existing = await this.ayService.getAcademicYearById(id);
    if (!existing) {
      throw new NotFoundException("Academic year not found.");
    }

    return this.ayService.deleteAcademicYear(id);
  }
}
