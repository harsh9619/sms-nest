import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { School } from "../../entities/school.entity.js";
import { MasterTheme } from "../../entities/master-theme.entity.js";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";
import { SchoolController } from "./school.controller.js";
import { SchoolService } from "./school.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      School,
      MasterTheme,
      AcademicYear,
      SchoolAcademicYear,
    ]),
  ],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
