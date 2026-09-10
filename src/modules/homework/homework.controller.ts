import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
} from "@nestjs/common";
import { HomeworkService } from "./homework.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/homework")
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  async getHomework(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string,
    @Query("teacherId") teacherIdStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    const teacherId = teacherIdStr ? toIntID(String(teacherIdStr)) : null;

    return this.homeworkService.getHomework(schoolId, classId, teacherId);
  }

  @Post()
  async createHomework(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { classId, subjectId, teacherId, title, description, dueDate } = body;

    return this.homeworkService.createHomework(schoolId, {
      classId: toIntID(classId),
      subjectId: toIntID(subjectId),
      teacherId: toIntID(teacherId),
      title,
      description,
      dueDate,
    });
  }

  @Put(":id")
  async updateHomework(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const homeworkId = toIntID(idStr);
    const { classId, subjectId, title, description, dueDate } = body;

    const updated = await this.homeworkService.updateHomework(homeworkId, {
      classId: toIntID(classId),
      subjectId: toIntID(subjectId),
      title,
      description,
      dueDate,
    });

    if (!updated) {
      throw new NotFoundException("Homework not found");
    }
    return updated;
  }

  @Delete(":id")
  async deleteHomework(@Param("id") idStr: string) {
    const homeworkId = toIntID(idStr);
    const deleted = await this.homeworkService.deleteHomework(homeworkId);
    if (!deleted) {
      throw new NotFoundException("Homework not found");
    }
    return deleted;
  }
}
