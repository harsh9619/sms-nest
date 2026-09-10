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
import { MarkService } from "./mark.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/marks")
export class MarkController {
  constructor(private readonly markService: MarkService) {}

  @Get()
  async getMarks(
    @Param("schoolId") schoolIdStr: string,
    @Query("studentId") studentIdStr?: string,
    @Query("subjectId") subjectIdStr?: string,
    @Query("classId") classIdStr?: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const studentId = studentIdStr ? toIntID(String(studentIdStr)) : null;
    const subjectId = subjectIdStr ? toIntID(String(subjectIdStr)) : null;
    const classId = classIdStr ? toIntID(String(classIdStr)) : null;

    return this.markService.getMarks(
      schoolId,
      studentId,
      subjectId,
      classId,
      academicYear
    );
  }

  @Post()
  async createOrUpdateMark(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { studentId, subjectId, examType, score, maxScore, examDate, enteredBy } = body;

    return this.markService.createOrUpdateMark(schoolId, {
      studentId: toIntID(studentId),
      subjectId: toIntID(subjectId),
      examType,
      score,
      maxScore,
      examDate,
      enteredBy: enteredBy ? toIntID(enteredBy) : null,
    });
  }

  @Put(":id")
  async updateMark(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const markId = toIntID(idStr);
    const { score, maxScore, examDate } = body;

    const updated = await this.markService.updateMark(markId, {
      score,
      maxScore,
      examDate,
    });

    if (!updated) {
      throw new NotFoundException("Marks record not found");
    }
    return updated;
  }

  @Delete(":id")
  async deleteMark(@Param("id") idStr: string) {
    const markId = toIntID(idStr);
    const deleted = await this.markService.deleteMark(markId);
    if (!deleted) {
      throw new NotFoundException("Marks record not found");
    }
    return deleted;
  }
}
