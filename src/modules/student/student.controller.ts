import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { StudentService } from "./student.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/students")
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  async getStudents(
    @Param("schoolId") schoolIdStr: string,
    @Query("academicYear") academicYear?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    return this.studentService.getStudents(schoolId, academicYear);
  }

  @Post()
  async createStudent(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const {
      name,
      email,
      phone,
      class: className,
      section,
      rollNumber,
      parentName,
      parentPhone,
      address,
      dateOfBirth,
      gender,
      bloodGroup,
    } = body;

    if (!name || !email || !rollNumber || !className || !section) {
      throw new BadRequestException(
        "Name, email, roll number, class, and section are required."
      );
    }

    const emailExists = await this.studentService.checkEmailExists(email, schoolId);
    if (emailExists) {
      throw new BadRequestException(
        "A user with this email already exists in this school."
      );
    }

    const classId = await this.studentService.getOrCreateClass(
      schoolId,
      className,
      section
    );

    const rollExists = await this.studentService.checkRollNumberExists(
      schoolId,
      classId,
      rollNumber
    );
    if (rollExists) {
      throw new BadRequestException(
        `Roll number ${rollNumber} already exists in Class ${className}-${section}.`
      );
    }

    try {
      const studentId = await this.studentService.createStudent(schoolId, {
        name,
        email,
        phone,
        classId,
        rollNumber,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender,
        bloodGroup,
      });

      return await this.studentService.getStudentById(studentId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException(
          "Duplicate email or duplicate class roll number exists."
        );
      }
      throw err;
    }
  }

  @Put(":id")
  async updateStudent(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const studentId = toIntID(idStr);
    const existing = await this.studentService.getStudentById(studentId);
    if (!existing) {
      throw new NotFoundException("Student not found");
    }

    const schoolId = existing.school_id;
    const userId = existing.user_id;

    const {
      name,
      email,
      phone,
      class: className,
      section,
      rollNumber,
      parentName,
      parentPhone,
      address,
      dateOfBirth,
      gender,
      bloodGroup,
    } = body;

    if (!name || !email || !rollNumber || !className || !section) {
      throw new BadRequestException(
        "Name, email, roll number, class, and section are required."
      );
    }

    const classId = await this.studentService.getOrCreateClass(
      schoolId,
      className,
      section
    );

    if (existing.email.toLowerCase() !== email.toLowerCase()) {
      const emailExists = await this.studentService.checkEmailExists(
        email,
        schoolId,
        userId
      );
      if (emailExists) {
        throw new BadRequestException(
          "A user with this email already exists in this school."
        );
      }
    }

    if (existing.class_id !== classId || existing.roll_no !== rollNumber) {
      const rollExists = await this.studentService.checkRollNumberExists(
        schoolId,
        classId,
        rollNumber,
        studentId
      );
      if (rollExists) {
        throw new BadRequestException(
          `Roll number ${rollNumber} already exists in Class ${className}-${section}.`
        );
      }
    }

    try {
      await this.studentService.updateStudent(studentId, userId, classId, {
        name,
        email,
        phone,
        rollNumber,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender,
        bloodGroup,
      });

      return await this.studentService.getStudentById(studentId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException(
          "Duplicate email or duplicate class roll number exists."
        );
      }
      throw err;
    }
  }

  @Delete(":id")
  async deleteStudent(@Param("id") idStr: string) {
    const studentId = toIntID(idStr);
    const existing = await this.studentService.getStudentById(studentId);
    if (!existing) {
      throw new NotFoundException("Student not found");
    }
    await this.studentService.deleteStudent(existing.user_id);
    return existing;
  }
}
