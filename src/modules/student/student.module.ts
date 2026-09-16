import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Student } from "../../entities/student.entity.js";
import { User } from "../../entities/user.entity.js";
import { Class } from "../../entities/class.entity.js";
import { ClassMaster } from "../../entities/class-master.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { StudentController } from "./student.controller.js";
import { StudentService } from "./student.service.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";

import { CasteMaster } from "../../entities/caste-master.entity.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      User,
      Class,
      ClassMaster,
      DivisionMaster,
      CasteMaster,
    ]),
    AcademicYearModule
  ],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule { }
