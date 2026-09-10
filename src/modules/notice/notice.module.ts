import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Notice } from "../../entities/notice.entity.js";
import { NoticeController } from "./notice.controller.js";
import { NoticeService } from "./notice.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Notice])],
  controllers: [NoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
