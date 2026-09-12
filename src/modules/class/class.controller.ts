import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Headers,
  Body,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ClassService } from "./class.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/classes")
export class ClassController {
  constructor(private readonly classService: ClassService) { }

  @Get("masters")
  async getClassMasters() {
    return this.classService.getClassMasters();
  }

  @Get("div_masters")
  async getDivisionMasters() {
    return this.classService.getDivisionMasters();
  }

  @Get()
  async getClasses(
    @Param("schoolId") schoolIdStr: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const academicYear = academicYearHeader ? toIntID(String(academicYearHeader)) : null;
    return this.classService.getClasses(schoolId, academicYear);
  }

  @Post()
  async createClass(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const {
      name,
      section,
      teacherId,
      subjects,
      classMasterId,
      divisionMasterId,
      schoolAcademicYearId,
      academicYear,
    } = body;

    if (!name) {
      throw new BadRequestException("Class name is required.");
    }

    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    try {
      const newClassId = await this.classService.createClass(schoolId, {
        name,
        section,
        teacherId: dbTeacherId,
        subjects,
        classMasterId,
        divisionMasterId,
        schoolAcademicYearId,
        academicYear: academicYear || null,
      });

      return await this.classService.getFullClassRecord(newClassId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A class with this name and section already exists.");
      }
      throw err;
    }
  }

  @Post("batch")
  async createClassesBatch(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr || "1"));
    const { classes } = body;

    if (!Array.isArray(classes) || classes.length === 0) {
      throw new BadRequestException("An array of class items is required.");
    }

    const headerSayId = academicYearHeader ? toIntID(String(academicYearHeader)) : null;

    return this.classService.createClassesBatch(schoolId, classes, headerSayId);
  }

  @Put(":id")
  async updateClass(
    @Param("id") idStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const classId = toIntID(idStr);
    const existing = await this.classService.getClassById(classId);
    if (!existing) {
      throw new NotFoundException("Class not found");
    }

    const schoolId = existing.school_id;
    const {
      name,
      section,
      teacherId,
      subjects,
      classMasterId,
      divisionMasterId,
      schoolAcademicYearId,
      academicYear,
    } = body;

    if (!name) {
      throw new BadRequestException("Class name is required.");
    }

    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    try {
      await this.classService.updateClass(
        classId,
        schoolId,
        {
          name,
          section,
          teacherId: dbTeacherId,
          subjects,
          classMasterId,
          divisionMasterId,
          schoolAcademicYearId,
          academicYear: academicYear || null,
        },
        academicYearHeader
      );

      return await this.classService.getFullClassRecord(classId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A class with this name and section already exists.");
      }
      throw err;
    }
  }

  @Delete(":id")
  async deleteClass(@Param("id") idStr: string) {
    const classId = toIntID(idStr);
    const existing = await this.classService.getFullClassRecord(classId);
    if (!existing) {
      throw new NotFoundException("Class not found");
    }

    await this.classService.deleteClass(classId);
    return existing;
  }

  @Get("class_teachers")
  async getSchoolClassTeachers(
    @Param("schoolId") schoolIdStr: string,
    @Query("classId") classIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    return this.classService.getSchoolClassTeachers(
      toIntID(String(schoolIdStr)),
      academicYearHeader ? toIntID(String(academicYearHeader)) : null,
      classIdStr ? toIntID(String(classIdStr)) : null
    );
  }

  @Put("class_teachers/:id")
  async updateTeacherForClass(
    @Param("schoolId") schoolIdStr: string,
    @Param("id") idStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : 1;
    const classId = toIntID(idStr);
    const rawTeacherId = body && typeof body === "object" ? body.teacherId : body;
    const teacherId = rawTeacherId ? toIntID(String(rawTeacherId)) : null;

    return this.classService.updateSchoolClassTeacher(
      classId,
      teacherId,
      schoolId,
      academicYearHeader
    );
  }
}
