import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity.js";
import { TeacherController } from "./teacher.controller.js";
import { TeacherService } from "./teacher.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
