import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { AcademicCalendarService } from "./academic-calendar.service.js";
import { toIntID } from "../../db/index.js";

@Controller(["api/academic-calendar", "api/:schoolId/academic-calendar"])
export class AcademicCalendarController {
  constructor(private readonly calendarService: AcademicCalendarService) {}

  @Get()
  async getOverview(
    @Param("schoolId") schoolIdStr?: string,
    @Query("month") month?: string,
    @Query("type") type?: string,
    @Query("role") role?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.getCalendarOverview(schoolId, { month, type, role });
  }

  @Get("events")
  async getEvents(
    @Param("schoolId") schoolIdStr?: string,
    @Query("month") month?: string,
    @Query("type") type?: string,
    @Query("role") role?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.getEvents(schoolId, { month, type, role });
  }

  @Get("config")
  async getWorkingConfig(@Param("schoolId") schoolIdStr?: string) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.getWorkingConfig(schoolId);
  }

  @Post("events")
  async createEvent(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    if (!body.title || !body.startDate) {
      throw new BadRequestException("Event title and startDate are required.");
    }
    const userId = body.createdBy ? toIntID(String(body.createdBy)) : null;
    return this.calendarService.createEvent(schoolId, userId, body);
  }

  @Put("events/:id")
  async updateEvent(
    @Param("id") idStr: string,
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const id = toIntID(idStr);
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.updateEvent(id, schoolId, body);
  }

  @Delete("events/:id")
  async deleteEvent(
    @Param("id") idStr: string,
    @Param("schoolId") schoolIdStr: string
  ) {
    const id = toIntID(idStr);
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.deleteEvent(id, schoolId);
  }

  @Post("config")
  async updateWorkingConfig(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.calendarService.updateWorkingConfig(schoolId, body);
  }
}
