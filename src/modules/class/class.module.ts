import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Class } from "../../entities/class.entity.js";
import { ClassMaster } from "../../entities/class-master.entity.js";
import { Subject } from "../../entities/subject.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";
import { ClassController } from "./class.controller.js";
import { ClassService } from "./class.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Class, ClassMaster, Subject, User]),
    AcademicYearModule,
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
