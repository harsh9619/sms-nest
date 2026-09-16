import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity.js";
import { Student } from "../../entities/student.entity.js";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";
import { AcademicYearModule } from "../academic-year/academic-year.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Student]),
    AcademicYearModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
