import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Attendance } from "../../entities/attendance.entity.js";
import { AttendanceController } from "./attendance.controller.js";
import { AttendanceService } from "./attendance.service.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    AcademicYearModule
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule { }
