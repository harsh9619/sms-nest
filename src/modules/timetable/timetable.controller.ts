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
    // @Query("divisionId") divisionIdStr?: string,
    @Query("division") divisionStr?: string,
    @Query("dayOfWeek") dayOfWeekStr?: string,
    // @Query("classMasterId") classMasterIdStr?: string,
    // @Query("divisionMasterId") divisionMasterIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    const teacherId = teacherIdStr ? toIntID(String(teacherIdStr)) : null;
    // const divisionId = divisionIdStr ? toIntID(String(divisionIdStr)) : null;
    const division = divisionStr ? String(divisionStr) : null;
    const dayOfWeek = dayOfWeekStr || null;
    // const classMasterId = classMasterIdStr ? toIntID(String(classMasterIdStr)) : null;
    // const divisionMasterId = divisionMasterIdStr ? toIntID(String(divisionMasterIdStr)) : null;

    return this.timetableService.getTimetables(
      schoolId,
      classId,
      teacherId,
      // divisionId,
      division,
      dayOfWeek,
      // classMasterId,
      // divisionMasterId,
      academicYearHeader
    );
  }

  @Post("generate")
  async generateTimetable(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
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

    return this.timetableService.generateTimetable(
      schoolId,
      {
        classId: classId ? toIntID(classId) : null,
        daysOfWeek,
        startTime,
        endTime,
        periodDuration: periodDuration ? Number(periodDuration) : undefined,
        breakStartTime,
        breakEndTime,
        clearExisting: clearExisting !== undefined ? Boolean(clearExisting) : true,
      },
      academicYearHeader
    );
  }

  @Post()
  async createTimetable(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { classId, classMasterId, divisionMasterId, subjectId, teacherId, dayOfWeek, startTime, endTime, classroom } = body;

    return this.timetableService.createTimetable(
      schoolId,
      {
        classId: classId ? toIntID(classId) : null,
        classMasterId: classMasterId ? toIntID(classMasterId) : null,
        divisionMasterId: divisionMasterId ? toIntID(divisionMasterId) : null,
        subjectId: toIntID(subjectId),
        teacherId: teacherId ? toIntID(teacherId) : null,
        dayOfWeek,
        startTime,
        endTime,
        classroom,
      },
      academicYearHeader
    );
  }

  @Put(":id")
  async updateTimetable(
    @Param("id") idStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const timetableId = toIntID(idStr);
    const { classId, classMasterId, divisionMasterId, subjectId, teacherId, dayOfWeek, startTime, endTime, classroom } = body;

    const updated = await this.timetableService.updateTimetable(
      timetableId,
      {
        classId: classId ? toIntID(classId) : null,
        classMasterId: classMasterId ? toIntID(classMasterId) : null,
        divisionMasterId: divisionMasterId ? toIntID(divisionMasterId) : null,
        subjectId: toIntID(subjectId),
        teacherId: teacherId ? toIntID(teacherId) : null,
        dayOfWeek,
        startTime,
        endTime,
        classroom,
      },
      academicYearHeader
    );

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
