import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subject } from "../../entities/subject.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";
import { SubjectController } from "./subject.controller.js";
import { SubjectService } from "./subject.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Subject, SubjectMaster, User])],
  controllers: [SubjectController],
  providers: [SubjectService],
  exports: [SubjectService],
})
export class SubjectModule {}
