import { Controller, Get, Post, Put, Body, Param, Query, Headers, Req } from "@nestjs/common";
import { AttendanceService } from "./attendance.service.js";
import { toIntID } from "../../db/index.js";
import jwt from "jsonwebtoken";

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
    @Req() req: any,
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { records: Array<{ studentId: string; classId?: string; date: string; status: string; remarks?: string; markedBy?: string }> }
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    let loggedInUserId: any = req.user?.sub || req.user?.id || req.user?.userId;
    if (!loggedInUserId && req.headers?.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.slice(7).trim();
        const jwtSecret = process.env.JWT_SECRET || "sms-jwt-secret";
        const verifyFn = jwt.verify || (jwt as any).default?.verify;
        const decoded = verifyFn(token, jwtSecret);
        loggedInUserId = decoded?.sub || decoded?.id || decoded?.userId;
      } catch (e) {
        // ignore decoding errors
      }
    }
    return this.attendanceService.saveAttendance(schoolId, body.records || [], loggedInUserId);
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
