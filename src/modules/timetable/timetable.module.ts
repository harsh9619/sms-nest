import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Timetable } from "../../entities/timetable.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { ClassSubject } from "../../entities/class-subject.entity.js";
import { SubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";
import { TimetableController } from "./timetable.controller.js";
import { TimetableService } from "./timetable.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Timetable,
      SchoolClass,
      ClassSubject,
      SubjectTeacher,
      SubjectMaster,
      User,
    ]),
    AcademicYearModule,
  ],
  controllers: [TimetableController],
  providers: [TimetableService],
  exports: [TimetableService],
})
export class TimetableModule { }
