import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { TeacherService } from "./teacher.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/teachers")
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get()
  async getTeachers(
    @Param("schoolId") schoolIdStr: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.teacherService.getTeachers(schoolId, academicYearHeader);
  }

  @Post()
  async createTeacher(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { name, email, phone, avatar, avatar_url, status } = body;

    if (!name || !email) {
      throw new BadRequestException("Name and email are required.");
    }

    const emailExists = await this.teacherService.checkEmailExists(email, schoolId);
    if (emailExists) {
      throw new BadRequestException("A user with this email already exists.");
    }

    try {
      return await this.teacherService.createTeacher(schoolId, {
        name,
        email,
        phone,
        avatar_url: avatar || avatar_url,
        status: status !== undefined ? Boolean(status) : undefined,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A user with this email already exists.");
      }
      throw err;
    }
  }

  @Put(":id")
  async updateTeacher(
    @Param("schoolId") schoolIdStr: string,
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const teacherId = toIntID(idStr);
    const schoolId = toIntID(String(schoolIdStr));

    const existing = await this.teacherService.getTeacherById(teacherId);
    if (!existing) {
      throw new NotFoundException("Teacher not found");
    }

    const { name, email, phone, avatar, avatar_url, status } = body;

    if (email && existing.email.toLowerCase() !== email.toLowerCase()) {
      const emailExists = await this.teacherService.checkEmailExists(email, schoolId, teacherId);
      if (emailExists) {
        throw new BadRequestException("A user with this email already exists.");
      }
    }

    try {
      return await this.teacherService.updateTeacher(teacherId, {
        name: name !== undefined ? name : existing.name,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        avatar_url: avatar || avatar_url || existing.avatar,
        status: status !== undefined ? Boolean(status) : existing.status,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A user with this email already exists.");
      }
      throw err;
    }
  }

  @Delete(":id")
  async deleteTeacher(
    @Param("id") idStr: string
  ) {
    const teacherId = toIntID(idStr);
    const existing = await this.teacherService.getTeacherById(teacherId);
    if (!existing) {
      throw new NotFoundException("Teacher not found");
    }
    await this.teacherService.deleteTeacher(teacherId);
    return { success: true, id: idStr, message: "Teacher deleted successfully" };
  }

  @Post("bulk")
  async bulkCreateTeachers(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { teachers: any[] }
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    if (!body.teachers || !Array.isArray(body.teachers)) {
      throw new BadRequestException("Expected an array of teachers under 'teachers' key.");
    }
    return this.teacherService.bulkCreateTeachers(schoolId, body.teachers);
  }
}

