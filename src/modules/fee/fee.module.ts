import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Fee } from "../../entities/fee.entity.js";
import { FeeController } from "./fee.controller.js";
import { FeeService } from "./fee.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Fee])],
  controllers: [FeeController],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
