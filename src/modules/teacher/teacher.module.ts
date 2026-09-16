import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity.js";
import { RoleMaster } from "../../entities/role-master.entity.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";
import { TeacherController } from "./teacher.controller.js";
import { TeacherService } from "./teacher.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([User, RoleMaster]), AcademicYearModule],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}

