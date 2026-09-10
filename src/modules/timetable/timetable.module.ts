import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Timetable } from "../../entities/timetable.entity.js";
import { TimetableController } from "./timetable.controller.js";
import { TimetableService } from "./timetable.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Timetable])],
  controllers: [TimetableController],
  providers: [TimetableService],
  exports: [TimetableService],
})
export class TimetableModule {}
