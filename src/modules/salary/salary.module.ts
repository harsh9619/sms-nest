import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SalaryRecord } from "../../entities/salary-record.entity.js";
import { SalaryStructure } from "../../entities/salary-structure.entity.js";
import { SalaryController } from "./salary.controller.js";
import { SalaryService } from "./salary.service.js";

import { AcademicYearModule } from "../academic-year/academic-year.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryRecord, SalaryStructure]),
    AcademicYearModule,
  ],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
