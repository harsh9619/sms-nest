import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademicCalendarEvent } from "../../entities/academic-calendar-event.entity.js";
import { SchoolWorkingDay } from "../../entities/school-working-day.entity.js";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";
import { AcademicCalendarService } from "./academic-calendar.service.js";
import { AcademicCalendarController } from "./academic-calendar.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicCalendarEvent,
      SchoolWorkingDay,
      AcademicYear,
      SchoolAcademicYear,
    ]),
  ],
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService],
  exports: [AcademicCalendarService],
})
export class AcademicCalendarModule {}
