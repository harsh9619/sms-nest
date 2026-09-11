import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Student } from "../../entities/student.entity.js";
import { User } from "../../entities/user.entity.js";
import { Class } from "../../entities/class.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { StudentController } from "./student.controller.js";
import { StudentService } from "./student.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Student, User, Class, DivisionMaster])],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
