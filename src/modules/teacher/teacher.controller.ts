import { Controller, Get, Param } from "@nestjs/common";
import { TeacherService } from "./teacher.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/teachers")
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get()
  async getTeachers(@Param("schoolId") schoolIdStr: string) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.teacherService.getTeachers(schoolId);
  }
}
