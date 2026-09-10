import { Controller, Get, Param, Query } from "@nestjs/common";
import { AttendanceService } from "./attendance.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  async getAttendance(
    @Param("schoolId") schoolIdStr: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.attendanceService.getAttendance(schoolId, academicYear);
  }
}
