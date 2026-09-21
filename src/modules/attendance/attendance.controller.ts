import { Controller, Get, Post, Put, Body, Param, Query, Headers } from "@nestjs/common";
import { AttendanceService } from "./attendance.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/attendance")
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService) { }


  @Get()
  async getAttendance(
    @Param("schoolId") schoolIdStr: string,
    @Query("date") date?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("classId") classIdStr?: string,
    @Query("divisionId") divisionIdStr?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const classId = classIdStr ? toIntID(String(classIdStr)) : undefined;
    const divisionId = divisionIdStr ? toIntID(String(divisionIdStr)) : undefined;

    return this.attendanceService.getAttendance(
      schoolId,
      academicYearHeader,
      date,
      startDate,
      endDate,
      classId,
      divisionId,
      status,
      search
    );
  }

  @Get("student/:studentId")
  async getStudentAttendance(
    @Param("schoolId") schoolIdStr: string,
    @Param("studentId") studentIdStr: string,
    @Query("month") month?: string,
    @Query("year") year?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const studentId = toIntID(String(studentIdStr));
    return this.attendanceService.getStudentAttendance(schoolId, studentId, month, year);
  }

  @Post()
  async saveAttendance(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { records: Array<{ studentId: string; classId?: string; date: string; status: string; remarks?: string; markedBy?: string }> }
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    return this.attendanceService.saveAttendance(schoolId, body.records || []);
  }

  @Put(":id")
  async updateAttendance(
    @Param("schoolId") schoolIdStr: string,
    @Param("id") idStr: string,
    @Body() body: { status?: string; remarks?: string }
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    const id = toIntID(String(idStr));
    return this.attendanceService.updateAttendance(schoolId, id, body);
  }
}
