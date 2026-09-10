import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Mark } from "../../entities/mark.entity.js";
import { MarkController } from "./mark.controller.js";
import { MarkService } from "./mark.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Mark])],
  controllers: [MarkController],
  providers: [MarkService],
  exports: [MarkService],
})
export class MarkModule {}
