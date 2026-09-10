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
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  async getTimetables(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string,
    @Query("teacherId") teacherIdStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    const teacherId = teacherIdStr ? toIntID(String(teacherIdStr)) : null;

    return this.timetableService.getTimetables(schoolId, classId, teacherId);
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
