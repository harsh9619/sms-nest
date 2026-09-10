import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { SubjectService } from "./subject.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/subjects")
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get("masters")
  async getSubjectMasters() {
    return this.subjectService.getSubjectMasters();
  }

  @Get()
  async getSubjects(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    return this.subjectService.getSubjects(schoolId, classId);
  }

  @Get("teachers")
  async getSubjectsWithTeachers(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;
    return this.subjectService.getSubjectsWithTeachers(schoolId, classId);
  }

  @Post("sync")
  async syncClassSubjects(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    const { classId, masterSubjectIds } = body;

    if (!classId || !Array.isArray(masterSubjectIds)) {
      throw new BadRequestException("classId and masterSubjectIds array are required");
    }

    return this.subjectService.syncClassSubjects(
      schoolId,
      toIntID(String(classId)),
      masterSubjectIds.map((id: any) => toIntID(String(id)))
    );
  }

  @Put("assign-teacher")
  async assignSubjectTeacher(@Body() body: any) {
    const { subjectId, teacherId } = body;
    if (!subjectId) {
      throw new BadRequestException("subjectId is required");
    }

    return this.subjectService.updateSubjectTeacher(
      toIntID(String(subjectId)),
      teacherId ? toIntID(String(teacherId)) : null
    );
  }
}
