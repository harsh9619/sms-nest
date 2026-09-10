import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Homework } from "../../entities/homework.entity.js";
import { HomeworkController } from "./homework.controller.js";
import { HomeworkService } from "./homework.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Homework])],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
