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
import { TimetableService } from "./timetable.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/timetables")
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) { }

  @Get()
  async getTimetables(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string,
    @Query("teacherId") teacherIdStr?: string,
    @Query("divisionId") divisionIdStr?: string,
    @Query("division") divisionStr?: string,
    @Query("dayOfWeek") dayOfWeekStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    const teacherId = teacherIdStr ? toIntID(String(teacherIdStr)) : null;
    const divisionId = divisionIdStr ? toIntID(String(divisionIdStr)) : null;
    const division = divisionStr || null;
    const dayOfWeek = dayOfWeekStr || null;

    return this.timetableService.getTimetables(
      schoolId,
      classId,
      teacherId,
      divisionId,
      division,
      dayOfWeek
    );
  }

  @Post("generate")
  async generateTimetable(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const {
      classId,
      daysOfWeek,
      startTime,
      endTime,
      periodDuration,
      breakStartTime,
      breakEndTime,
      clearExisting,
    } = body;

    return this.timetableService.generateTimetable(schoolId, {
      classId: classId ? toIntID(classId) : null,
      daysOfWeek,
      startTime,
      endTime,
      periodDuration: periodDuration ? Number(periodDuration) : undefined,
      breakStartTime,
      breakEndTime,
      clearExisting: clearExisting !== undefined ? Boolean(clearExisting) : true,
    });
  }

  @Post()
  async createTimetable(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { classId, subjectId, dayOfWeek, startTime, endTime, classroom } = body;

    return this.timetableService.createTimetable(schoolId, {
      classId: toIntID(classId),
      subjectId: toIntID(subjectId),
      dayOfWeek,
      startTime,
      endTime,
      classroom,
    });
  }

  @Put(":id")
  async updateTimetable(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const timetableId = toIntID(idStr);
    const { classId, subjectId, dayOfWeek, startTime, endTime, classroom } = body;

    const updated = await this.timetableService.updateTimetable(timetableId, {
      classId: toIntID(classId),
      subjectId: toIntID(subjectId),
      dayOfWeek,
      startTime,
      endTime,
      classroom,
    });

    if (!updated) {
      throw new NotFoundException("Timetable slot not found");
    }
    return updated;
  }

  @Delete(":id")
  async deleteTimetable(@Param("id") idStr: string) {
    const timetableId = toIntID(idStr);
    const deleted = await this.timetableService.deleteTimetable(timetableId);
    if (!deleted) {
      throw new NotFoundException("Timetable slot not found");
    }
    return deleted;
  }
}
