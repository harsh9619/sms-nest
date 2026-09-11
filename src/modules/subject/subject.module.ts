import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { SchoolClassSubject } from "../../entities/class-subject.entity.js";
import { SchoolSubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { User } from "../../entities/user.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { SubjectController } from "./subject.controller.js";
import { SubjectService } from "./subject.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubjectMaster,
      SchoolClassSubject,
      SchoolSubjectTeacher,
      User,
      DivisionMaster,
    ]),
  ],
  controllers: [SubjectController],
  providers: [SubjectService],
  exports: [SubjectService],
})
export class SubjectModule {}

