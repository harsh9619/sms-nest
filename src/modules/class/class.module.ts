import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Class } from "../../entities/class.entity.js";
import { ClassMaster } from "../../entities/class-master.entity.js";
import { Subject } from "../../entities/subject.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { ClassSubject } from "../../entities/class-subject.entity.js";
import { ClassTeacher } from "../../entities/class-teacher.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";
import { ClassController } from "./class.controller.js";
import { ClassService } from "./class.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      ClassMaster,
      SubjectMaster,
      User,
      SchoolClass,
      ClassSubject,
      ClassTeacher,
      DivisionMaster,
    ]),
    AcademicYearModule,
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
