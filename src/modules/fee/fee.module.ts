import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Fee } from "../../entities/fee.entity.js";
import { SchoolClassFeeStructure } from "../../entities/class-fee-structure.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { FeeController } from "./fee.controller.js";
import { FeeService } from "./fee.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Fee, SchoolClassFeeStructure, Student, SchoolClass]),
  ],
  controllers: [FeeController],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
