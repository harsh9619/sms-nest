import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity.js";
import { Student } from "../../entities/student.entity.js";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([User, Student])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
