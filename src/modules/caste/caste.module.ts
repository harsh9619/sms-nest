import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CasteMaster } from "../../entities/caste-master.entity.js";
import { CasteController } from "./caste.controller.js";
import { CasteService } from "./caste.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([CasteMaster])],
  controllers: [CasteController],
  providers: [CasteService],
  exports: [CasteService],
})
export class CasteModule {}
