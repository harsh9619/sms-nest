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
  Headers
} from "@nestjs/common";
import { StudentService } from "./student.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/students")
export class StudentController {
  constructor(private readonly studentService: StudentService) { }

  @Get("export")
  async exportStudents(
    @Param("schoolId") schoolIdStr: string,
    @Query("search") search?: string,
    @Query("classId") classIdStr?: string,
    @Query("sectionId") sectionIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const classId = classIdStr && classIdStr !== "all" ? toIntID(classIdStr) : undefined;
    const sectionId = sectionIdStr && sectionIdStr !== "all" ? toIntID(sectionIdStr) : undefined;

    return this.studentService.exportStudents(schoolId, academicYearHeader, {
      search,
      classId,
      sectionId,
    });
  }

  @Get()
  async getStudents(
    @Param("schoolId") schoolIdStr: string,
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
    @Query("search") search?: string,
    @Query("classId") classIdStr?: string,
    @Query("sectionId") sectionIdStr?: string,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const classId = classIdStr && classIdStr !== "all" ? toIntID(classIdStr) : undefined;
    const sectionId = sectionIdStr && sectionIdStr !== "all" ? toIntID(sectionIdStr) : undefined;

    return this.studentService.getStudents(schoolId, academicYearHeader, {
      page,
      limit,
      search,
      classId,
      sectionId,
    });
  }

  @Post()
  async createStudent(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const {
      name,
      email,
      phone,
      class: className,
      section,
      class_id,
      division_master_id,
      rollNumber,
      roll_no,
      parentName,
      guardian_name,
      parentPhone,
      guardian_phone,
      address,
      dateOfBirth,
      dob,
      gender,
      bloodGroup,
      blood_group,
      admissionDate,
      admission_date,
      school_academic_year_id,
    } = body;

    const finalRollNumber = rollNumber || roll_no;
    const finalParentName = parentName || guardian_name;
    const finalParentPhone = parentPhone || guardian_phone;
    const finalDob = dateOfBirth || dob;
    const finalBloodGroup = bloodGroup || blood_group;
    const finalAdmissionDate = admissionDate || admission_date;

    if (!name) {
      throw new BadRequestException("Name are required.");
    }

    // const emailExists = await this.studentService.checkEmailExists(email, schoolId);
    // if (emailExists) {
    //   throw new BadRequestException("A user with this email already exists in this school.");
    // }

    let finalClassId: number | undefined = class_id ? toIntID(String(class_id)) : undefined;
    let finalDivMasterId: number | undefined = division_master_id ? toIntID(String(division_master_id)) : undefined;

    if (finalClassId) {
      const validClass = await this.studentService.getClassById(schoolId, finalClassId);
      if (!validClass) {
        finalClassId = undefined;
      }
    }

    if (!finalClassId && className) {
      finalClassId = await this.studentService.getOrCreateClass(
        schoolId,
        className,
        section || "A"
      );
    }

    if (finalClassId && finalRollNumber) {
      const rollExists = await this.studentService.checkRollNumberExists(
        schoolId,
        finalClassId,
        finalRollNumber
      );
      if (rollExists) {
        throw new BadRequestException(
          `Roll number ${finalRollNumber} already exists in this class.`
        );
      }
    }

    try {
      const studentId = await this.studentService.createStudent(schoolId, academicYearHeader, {
        name,
        email,
        phone,
        classId: finalClassId,
        divisionMasterId: finalDivMasterId,
        rollNumber: finalRollNumber,
        parentName: finalParentName,
        parentPhone: finalParentPhone,
        address,
        dateOfBirth: finalDob,
        gender,
        bloodGroup: finalBloodGroup,
        admissionDate: finalAdmissionDate,
        school_academic_year_id: school_academic_year_id ? toIntID(String(school_academic_year_id)) : undefined,
      });

      return await this.studentService.getStudentById(studentId);
    } catch (err: any) {
      if (err.code === "23505") {
        const detail = err.detail || "";
        if (detail.includes("email")) {
          throw new BadRequestException("Student with this email already exists.");
        }
        if (detail.includes("roll")) {
          throw new BadRequestException("Student with this roll number already exists in this class.");
        }
        throw new BadRequestException(
          "Duplicate entry: A student with the same email or class roll number already exists."
        );
      }
      throw err;
    }
  }

  @Put(":id")
  async updateStudent(
    @Param("id") idStr: string,
    @Body() body: any,
    @Headers("academicyearid") academicYearHeader?: string
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
      class_id,
      division_master_id,
      rollNumber,
      roll_no,
      parentName,
      guardian_name,
      parentPhone,
      guardian_phone,
      address,
      dateOfBirth,
      dob,
      gender,
      bloodGroup,
      blood_group,
      admissionDate,
      admission_date,
      school_academic_year_id,
      casteMasterId,
      caste_master_id,
      casteCategory,
      caste_category,
      registrationNo,
      registration_no,
      academicYear,
      academic_year,
      aadharNo,
      aadhar_no,
      medium,
      fatherName,
      father_name,
      fatherOccupation,
      father_occupation,
      fatherQualification,
      father_qualification,
      motherName,
      mother_name,
      motherOccupation,
      mother_occupation,
      motherQualification,
      mother_qualification,
      whatsappNo,
      whatsapp_no,
      scholarNo,
      scholar_no,
    } = body;

    const finalName = name || existing.name;
    const finalEmail = email !== undefined ? email : existing.email;
    const finalRollNumber = rollNumber !== undefined ? rollNumber : (roll_no !== undefined ? roll_no : existing.roll_no);
    const finalParentName = parentName !== undefined ? parentName : (guardian_name !== undefined ? guardian_name : existing.guardian_name);
    const finalParentPhone = parentPhone !== undefined ? parentPhone : (guardian_phone !== undefined ? guardian_phone : existing.guardian_phone);
    const finalDob = dateOfBirth !== undefined ? dateOfBirth : (dob !== undefined ? dob : existing.dob);
    const finalBloodGroup = bloodGroup !== undefined ? bloodGroup : (blood_group !== undefined ? blood_group : existing.blood_group);
    const finalAdmissionDate = admissionDate !== undefined ? admissionDate : (admission_date !== undefined ? admission_date : existing.admission_date);

    let finalClassId: number | undefined = class_id !== undefined ? (class_id ? toIntID(String(class_id)) : undefined) : (existing.class_id ? toIntID(existing.class_id) : undefined);
    let finalDivMasterId: number | undefined = division_master_id !== undefined ? (division_master_id ? toIntID(String(division_master_id)) : undefined) : (existing.division_master_id ? toIntID(existing.division_master_id) : undefined);

    if (!finalClassId && className) {
      finalClassId = await this.studentService.getOrCreateClass(
        schoolId,
        className,
        section || existing.division_name || "A"
      );
    }

    if (finalEmail && String(finalEmail).trim() && existing.email.toLowerCase() !== String(finalEmail).trim().toLowerCase()) {
      const emailExists = await this.studentService.checkEmailExists(
        String(finalEmail).trim(),
        schoolId,
        userId
      );
      if (emailExists) {
        throw new BadRequestException("A user with this email already exists in this school.");
      }
    }

    const existingClassId = existing.class_id ? toIntID(existing.class_id) : undefined;
    if (finalClassId && finalRollNumber && (existingClassId !== finalClassId || existing.roll_no !== finalRollNumber)) {
      const rollExists = await this.studentService.checkRollNumberExists(
        schoolId,
        finalClassId,
        finalRollNumber,
        studentId
      );
      if (rollExists) {
        throw new BadRequestException(
          `Roll number ${finalRollNumber} already exists in this class.`
        );
      }
    }

    try {
      await this.studentService.updateStudent(studentId, userId, academicYearHeader, {
        name: finalName,
        email: finalEmail,
        phone: phone !== undefined ? phone : existing.phone,
        classId: finalClassId,
        divisionMasterId: finalDivMasterId,
        rollNumber: finalRollNumber,
        parentName: finalParentName,
        parentPhone: finalParentPhone,
        address: address !== undefined ? address : existing.address,
        dateOfBirth: finalDob,
        gender: gender || existing.gender,
        bloodGroup: finalBloodGroup,
        admissionDate: finalAdmissionDate,
        school_academic_year_id: school_academic_year_id ? toIntID(String(school_academic_year_id)) : (existing.school_academic_year_id ? toIntID(existing.school_academic_year_id) : undefined),
        casteMasterId: casteMasterId !== undefined ? casteMasterId : caste_master_id,
        casteCategory: casteCategory !== undefined ? casteCategory : caste_category,
        registrationNo: registrationNo !== undefined ? registrationNo : registration_no,
        academicYear: academicYear !== undefined ? academicYear : academic_year,
        aadharNo: aadharNo !== undefined ? aadharNo : aadhar_no,
        medium,
        fatherName: fatherName !== undefined ? fatherName : father_name,
        fatherOccupation: fatherOccupation !== undefined ? fatherOccupation : father_occupation,
        fatherQualification: fatherQualification !== undefined ? fatherQualification : father_qualification,
        motherName: motherName !== undefined ? motherName : mother_name,
        motherOccupation: motherOccupation !== undefined ? motherOccupation : mother_occupation,
        motherQualification: motherQualification !== undefined ? motherQualification : mother_qualification,
        whatsappNo: whatsappNo !== undefined ? whatsappNo : whatsapp_no,
        scholarNo: scholarNo !== undefined ? scholarNo : scholar_no,
      });

      return await this.studentService.getStudentById(studentId);
    } catch (err: any) {
      if (err.code === "23505") {
        const detail = err.detail || "";
        if (detail.includes("email")) {
          throw new BadRequestException("Student with this email already exists.");
        }
        if (detail.includes("roll")) {
          throw new BadRequestException("Student with this roll number already exists in this class.");
        }
        throw new BadRequestException(
          "Duplicate entry: A student with the same email or class roll number already exists."
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

  @Post("bulk")
  async bulkCreateStudents(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: { students: any[] },
    @Headers("academicyearid") academicYearHeader?: string
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    if (!body.students || !Array.isArray(body.students)) {
      throw new BadRequestException("Expected an array of students under 'students' key.");
    }
    return this.studentService.bulkCreateStudents(schoolId, academicYearHeader, body.students);
  }
}


