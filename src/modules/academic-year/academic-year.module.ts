import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";
import { AcademicYearController } from "./academic-year.controller.js";
import { AcademicYearService } from "./academic-year.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AcademicYear, SchoolAcademicYear])],
  controllers: [AcademicYearController],
  providers: [AcademicYearService],
  exports: [AcademicYearService],
})
export class AcademicYearModule {}
