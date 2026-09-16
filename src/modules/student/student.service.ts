import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Student } from "../../entities/student.entity.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { Class } from "../../entities/class.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";

import { ClassMaster } from "../../entities/class-master.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { CasteMaster } from "../../entities/caste-master.entity.js";
import { getRoleId } from "../../common/utils/role.util.js";

export interface GetStudentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  classId?: number;
  sectionId?: number;
}

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(ClassMaster)
    private classMasterRepo: Repository<ClassMaster>,
    @InjectRepository(DivisionMaster)
    private divisionMasterRepo: Repository<DivisionMaster>,
    @InjectRepository(CasteMaster)
    private casteMasterRepo: Repository<CasteMaster>,
    private ayService: AcademicYearService,
    private dataSource: DataSource
  ) { }

  async getStudents(schoolId?: number, academicYearHeader?: string, options?: GetStudentsOptions) {
    const page = options?.page && options.page > 0 ? Number(options.page) : 1;
    const limit = options?.limit && options.limit > 0 ? Number(options.limit) : 10;
    const skip = (page - 1) * limit;
    let sayId: number | null = null;
    sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);

    const qb = this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.division_master", "dm")
      .leftJoinAndSelect("st.caste_master", "cm")
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .where("u.is_active = :isActive", { isActive: true })
      .andWhere("st.is_deleted = :isDeleted", { isDeleted: false });

    if (schoolId) {
      qb.andWhere("st.school_id = :schoolId", { schoolId });
    }
    if (options?.classId) {
      qb.andWhere("st.class_id = :classId", { classId: options.classId });
    }
    if (options?.sectionId) {
      qb.andWhere("(st.division_master_id = :sectionId OR c.division_master_id = :sectionId)", { sectionId: options.sectionId });
    }
    if (options?.search) {
      const s = `%${options.search.trim()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE LOWER(:s) OR LOWER(u.email) LIKE LOWER(:s) OR LOWER(st.roll_no) LIKE LOWER(:s) OR LOWER(st.guardian_name) LIKE LOWER(:s) OR LOWER(st.guardian_phone) LIKE LOWER(:s))",
        { s }
      );
    }
    qb.andWhere("st.school_academic_year_id = :sayId", { sayId: sayId });
    qb.orderBy("c.name", "ASC")
      .addOrderBy("dm.name", "ASC")
      .addOrderBy("st.roll_no", "ASC");

    const [students, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const formattedStudents = students.map((st) => this.formatStudentResponse(st));

    return {
      data: formattedStudents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async exportStudents(schoolId?: number, academicYearHeader?: string, options?: Omit<GetStudentsOptions, 'page' | 'limit'>) {
    let sayId: number | null = null;
    sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);

    const qb = this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.division_master", "dm")
      .leftJoinAndSelect("st.caste_master", "cm")
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .where("u.is_active = :isActive", { isActive: true })
      .andWhere("st.is_deleted = :isDeleted", { isDeleted: false });

    if (schoolId) {
      qb.andWhere("st.school_id = :schoolId", { schoolId });
    }
    if (options?.classId) {
      qb.andWhere("st.class_id = :classId", { classId: options.classId });
    }
    if (options?.sectionId) {
      qb.andWhere("(st.division_master_id = :sectionId OR c.division_master_id = :sectionId)", { sectionId: options.sectionId });
    }
    if (options?.search) {
      const s = `%${options.search.trim()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE LOWER(:s) OR LOWER(u.email) LIKE LOWER(:s) OR LOWER(st.roll_no) LIKE LOWER(:s) OR LOWER(st.guardian_name) LIKE LOWER(:s) OR LOWER(st.guardian_phone) LIKE LOWER(:s))",
        { s }
      );
    }
    qb.andWhere("st.school_academic_year_id = :sayId", { sayId: sayId });
    qb.orderBy("c.name", "ASC")
      .addOrderBy("dm.name", "ASC")
      .addOrderBy("st.roll_no", "ASC");

    const students = await qb.getMany();
    return students.map((st) => this.formatStudentResponse(st));
  }

  async getStudentById(id: number) {
    const st = await this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.division_master", "dm")
      .leftJoinAndSelect("st.caste_master", "cm")
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .where("st.id = :id", { id })
      .getOne();

    return st ? this.formatStudentResponse(st) : null;
  }

  async checkEmailExists(email: string, schoolId: number, excludeUserId?: number) {
    const qb = this.userRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email })
      .andWhere("u.school_id = :schoolId", { schoolId })
      .andWhere("u.role = :studentRole", { studentRole: UserRole.STUDENT });

    if (excludeUserId) {
      qb.andWhere("u.id != :excludeUserId", { excludeUserId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  async checkRollNumberExists(
    schoolId: number,
    classId: number,
    rollNumber: string,
    excludeStudentId?: number
  ) {
    const qb = this.studentRepo
      .createQueryBuilder("st")
      .where("st.school_id = :schoolId", { schoolId })
      .andWhere("st.class_id = :classId", { classId })
      .andWhere("st.roll_no = :rollNumber", { rollNumber })
      .andWhere("st.is_deleted = :isDeleted", { isDeleted: false });

    if (excludeStudentId) {
      qb.andWhere("st.id != :excludeStudentId", { excludeStudentId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  async getClassById(schoolId: number, classId: number) {
    return await this.classRepo.findOne({
      where: { id: classId, school_id: schoolId },
    });
  }

  async getOrCreateClass(schoolId: number, className: string, section: string, sayId?: number | null) {
    const rawClass = String(className || "").trim();
    let formattedClassName = rawClass;
    if (rawClass && !/^class/i.test(rawClass)) {
      formattedClassName = `Class ${rawClass.toUpperCase()}`;
    } else if (rawClass) {
      formattedClassName = rawClass.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const formattedSection = String(section || "").trim().toUpperCase();

    const whereCondition: any = { school_id: schoolId, name: formattedClassName, division: formattedSection };
    if (sayId) {
      whereCondition.school_academic_year_id = sayId;
    }
    let cls = await this.classRepo.findOne({
      where: whereCondition,
    });

    if (!cls) {
      // Resolve class_master_id dynamically from classMasterRepo
      let classMasterId: number | null = null;
      const cmMatch = await this.classMasterRepo.createQueryBuilder("cm")
        .where("LOWER(cm.name) = LOWER(:name) OR LOWER(cm.name) = LOWER(:raw)", {
          name: formattedClassName,
          raw: rawClass,
        })
        .getOne();
      if (cmMatch) {
        classMasterId = cmMatch.id;
      } else {
        const firstCm = await this.classMasterRepo.findOne({ order: { id: "ASC" } });
        classMasterId = firstCm ? firstCm.id : 1;
      }

      // Resolve division_master_id dynamically from divisionMasterRepo
      let divisionMasterId: number | null = null;
      const dmMatch = await this.divisionMasterRepo.createQueryBuilder("dm")
        .where("LOWER(dm.name) = LOWER(:sec) OR LOWER(dm.code) = LOWER(:sec)", {
          sec: formattedSection,
        })
        .getOne();
      if (dmMatch) {
        divisionMasterId = dmMatch.id;
      } else {
        const firstDm = await this.divisionMasterRepo.findOne({ order: { id: "ASC" } });
        divisionMasterId = firstDm ? firstDm.id : 1;
      }

      cls = this.classRepo.create({
        school_id: schoolId,
        school_academic_year_id: sayId || undefined,
        name: formattedClassName,
        division: formattedSection,
        class_master_id: classMasterId,
        division_master_id: divisionMasterId,
      });
      cls = await this.classRepo.save(cls);
    }

    return cls.id;
  }

  async createStudent(schoolId: number, academicYearHeader: string | undefined, data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        name,
        email,
        phone,
        classId,
        divisionMasterId,
        rollNumber,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender,
        bloodGroup,
        admissionDate,
        school_academic_year_id,
      } = data;

      let sayId = school_academic_year_id;
      if (!sayId) {
        sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
      }

      let studentEmail = "";
      if (email && String(email).trim()) {
        const cleanEmail = String(email).trim().toLowerCase();
        const existingUser = await queryRunner.manager.findOne(User, {
          where: { email: cleanEmail, school_id: schoolId },
        });
        if (existingUser) {
          throw new BadRequestException(`Email "${cleanEmail}" is already registered.`);
        }
        studentEmail = cleanEmail;
      } else {
        studentEmail = `student_${Date.now()}_${Math.floor(Math.random() * 1000)}@school.com`;
      }

      const newUser = queryRunner.manager.create(User, {
        school_id: schoolId,
        name,
        email: studentEmail,
        password: "password123",
        role_id: getRoleId(UserRole.STUDENT),
        role: UserRole.STUDENT,
        phone: phone || null,
      });
      const savedUser = await queryRunner.manager.save(User, newUser);

      // Handle parent user creation / update in users table
      let parentUser: User | null = null;
      if (parentName) {
        const targetParentEmail = data.parentEmail || data.parent_email || email;
        // 1. First search for existing user by email if parentEmail/email is provided and matches role parent
        if (targetParentEmail) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { email: String(targetParentEmail).toLowerCase(), school_id: schoolId, role: UserRole.PARENT },
          });
        }

        // 2. Search for existing user (Parent or Teacher) by phone
        if (!parentUser && parentPhone) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { phone: parentPhone, school_id: schoolId },
          });
        }

        // 3. Search by parent_name & role=parent
        if (!parentUser) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { name: parentName, school_id: schoolId, role: UserRole.PARENT },
          });
        }

        if (parentUser) {
          // Keep existing role (e.g. if user is a teacher, keep teacher role)
          parentUser.is_active = true;
          await queryRunner.manager.save(User, parentUser);
        } else {
          const rawParentEmail = data.parentEmail || data.parent_email;
          const safePhone = parentPhone ? parentPhone.replace(/[^0-9]/g, "") : "";
          const parentEmail = rawParentEmail ? String(rawParentEmail).toLowerCase() : (email ? email.toLowerCase() : (safePhone ? `parent_${safePhone}@school.com` : `parent_${savedUser.id}@school.com`));

          const newParentUser = queryRunner.manager.create(User, {
            school_id: schoolId,
            name: parentName,
            email: parentEmail,
            password: "password123",
            role_id: getRoleId(UserRole.PARENT),
            role: UserRole.PARENT,
            phone: parentPhone || null,
            is_active: true,
          });
          parentUser = await queryRunner.manager.save(User, newParentUser);
        }
      }

      const dobValue = dateOfBirth ? dateOfBirth : null;
      const admissionDateValue = admissionDate ? admissionDate : null;
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      let finalRollNo = rollNumber ? String(rollNumber).trim() : null;
      if (!finalRollNo && classId) {
        const maxRollStudent = await queryRunner.manager
          .createQueryBuilder(Student, "st")
          .where("st.school_id = :schoolId", { schoolId })
          .andWhere("st.class_id = :classId", { classId })
          .andWhere("st.is_deleted = :isDeleted", { isDeleted: false })
          .andWhere("st.roll_no ~ '^[0-9]+$'")
          .orderBy("CAST(st.roll_no AS INTEGER)", "DESC")
          .getOne();

        const currentDbMax = maxRollStudent && maxRollStudent.roll_no ? parseInt(maxRollStudent.roll_no, 10) : 0;
        const nextRollInt = currentDbMax + 1;
        finalRollNo = String(nextRollInt).padStart(4, "0");
      }

      const newStudent = queryRunner.manager.create(Student, {
        school_id: schoolId,
        school_academic_year_id: sayId || null,
        user_id: savedUser.id,
        parent_user_id: parentUser ? parentUser.id : null,
        class_id: classId || null,
        division_master_id: divisionMasterId || null,
        caste_master_id: data.casteMasterId || data.caste_master_id || null,
        caste_category: data.casteCategory || data.caste_category || null,
        registration_no: data.registrationNo || data.registration_no || null,
        academic_year: data.academicYear || data.academic_year || null,
        aadhar_no: data.aadharNo || data.aadhar_no || null,
        medium: data.medium || null,
        father_name: data.fatherName || data.father_name || parentName || null,
        father_occupation: data.fatherOccupation || data.father_occupation || null,
        father_qualification: data.fatherQualification || data.father_qualification || null,
        mother_name: data.motherName || data.mother_name || null,
        mother_occupation: data.motherOccupation || data.mother_occupation || null,
        mother_qualification: data.motherQualification || data.mother_qualification || null,
        whatsapp_no: data.whatsappNo || data.whatsapp_no || null,
        scholar_no: data.scholarNo || data.scholar_no || null,
        roll_no: finalRollNo,
        dob: dobValue,
        gender: genderValue,
        blood_group: bloodGroup || null,
        address: address || null,
        guardian_name: parentName || null,
        guardian_phone: parentPhone || null,
        admission_date: admissionDateValue,
      });
      const savedStudent = await queryRunner.manager.save(Student, newStudent);

      await queryRunner.commitTransaction();
      return savedStudent.id;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStudent(
    studentId: number,
    userId: number,
    academicYearHeader: string | undefined,
    data: any
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        name,
        email,
        phone,
        classId,
        divisionMasterId,
        rollNumber,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender,
        bloodGroup,
        admissionDate,
        school_academic_year_id,
      } = data;

      let cleanEmail: string | undefined = undefined;
      if (email !== undefined) {
        const trimmedEmail = String(email).trim();
        if (trimmedEmail) {
          cleanEmail = trimmedEmail.toLowerCase();
          const existingUser = await queryRunner.manager.createQueryBuilder(User, "u")
            .where("LOWER(u.email) = LOWER(:email)", { email: cleanEmail })
            .andWhere("u.id != :userId", { userId })
            .getOne();
          if (existingUser) {
            throw new BadRequestException(`Email "${cleanEmail}" is already in use by another user.`);
          }
        }
      }

      await queryRunner.manager.update(User, userId, {
        name,
        email: cleanEmail !== undefined ? cleanEmail : undefined,
        phone: phone !== undefined ? phone : undefined,
        role_id: getRoleId(UserRole.STUDENT),
      });

      const dobValue = dateOfBirth ? dateOfBirth : null;
      const admissionDateValue = admissionDate ? admissionDate : null;
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      // Handle Parent user update / creation
      const studentRec = await queryRunner.manager.findOne(Student, { where: { id: studentId } });
      const currentParentName = parentName !== undefined ? parentName : studentRec?.guardian_name;
      const currentParentPhone = parentPhone !== undefined ? parentPhone : studentRec?.guardian_phone;

      let parentUser: User | null = null;
      if (currentParentName) {
        if (email) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { email: email.toLowerCase(), role: UserRole.PARENT },
          });
        }

        if (!parentUser && currentParentPhone) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { phone: currentParentPhone },
          });
        }

        if (!parentUser) {
          parentUser = await queryRunner.manager.findOne(User, {
            where: { name: currentParentName, role: UserRole.PARENT },
          });
        }

        if (parentUser) {
          parentUser.is_active = true;
          await queryRunner.manager.save(User, parentUser);
        } else {
          const studentUser = await queryRunner.manager.findOne(User, { where: { id: userId } });
          const rawParentEmail = data.parentEmail || data.parent_email;
          const safePhone = currentParentPhone ? currentParentPhone.replace(/[^0-9]/g, "") : "";
          const parentEmail = rawParentEmail ? String(rawParentEmail).toLowerCase() : (email ? email.toLowerCase() : (safePhone ? `parent_${safePhone}@school.com` : `parent_${userId}@school.com`));

          const newParentUser = queryRunner.manager.create(User, {
            school_id: studentUser?.school_id || undefined,
            name: currentParentName,
            email: parentEmail,
            password: "password123",
            role_id: getRoleId(UserRole.PARENT),
            role: UserRole.PARENT,
            phone: currentParentPhone || null,
            is_active: true,
          });
          parentUser = await queryRunner.manager.save(User, newParentUser);
        }
      }

      const studentUpdate: any = {
        gender: genderValue,
        dob: dobValue,
        guardian_name: parentName !== undefined ? parentName : undefined,
        guardian_phone: parentPhone !== undefined ? parentPhone : undefined,
        address: address !== undefined ? address : undefined,
        blood_group: bloodGroup !== undefined ? bloodGroup : undefined,
        admission_date: admissionDateValue,
      };

      if (data.casteMasterId !== undefined || data.caste_master_id !== undefined) {
        studentUpdate.caste_master_id = data.casteMasterId || data.caste_master_id || null;
      }
      if (data.casteCategory !== undefined || data.caste_category !== undefined) {
        studentUpdate.caste_category = data.casteCategory || data.caste_category || null;
      }
      if (data.registrationNo !== undefined || data.registration_no !== undefined) {
        studentUpdate.registration_no = data.registrationNo || data.registration_no || null;
      }
      if (data.academicYear !== undefined || data.academic_year !== undefined) {
        studentUpdate.academic_year = data.academicYear || data.academic_year || null;
      }
      if (data.aadharNo !== undefined || data.aadhar_no !== undefined) {
        studentUpdate.aadhar_no = data.aadharNo || data.aadhar_no || null;
      }
      if (data.medium !== undefined) {
        studentUpdate.medium = data.medium || null;
      }
      if (data.fatherName !== undefined || data.father_name !== undefined) {
        studentUpdate.father_name = data.fatherName || data.father_name || null;
      }
      if (data.fatherOccupation !== undefined || data.father_occupation !== undefined) {
        studentUpdate.father_occupation = data.fatherOccupation || data.father_occupation || null;
      }
      if (data.fatherQualification !== undefined || data.father_qualification !== undefined) {
        studentUpdate.father_qualification = data.fatherQualification || data.father_qualification || null;
      }
      if (data.motherName !== undefined || data.mother_name !== undefined) {
        studentUpdate.mother_name = data.motherName || data.mother_name || null;
      }
      if (data.motherOccupation !== undefined || data.mother_occupation !== undefined) {
        studentUpdate.mother_occupation = data.motherOccupation || data.mother_occupation || null;
      }
      if (data.motherQualification !== undefined || data.mother_qualification !== undefined) {
        studentUpdate.mother_qualification = data.motherQualification || data.mother_qualification || null;
      }
      if (data.whatsappNo !== undefined || data.whatsapp_no !== undefined) {
        studentUpdate.whatsapp_no = data.whatsappNo || data.whatsapp_no || null;
      }
      if (data.scholarNo !== undefined || data.scholar_no !== undefined) {
        studentUpdate.scholar_no = data.scholarNo || data.scholar_no || null;
      }

      if (parentUser) {
        studentUpdate.parent_user_id = parentUser.id;
      }
      if (classId !== undefined) {
        studentUpdate.class_id = classId;
      }
      if (divisionMasterId !== undefined) {
        studentUpdate.division_master_id = divisionMasterId;
      }
      if (rollNumber !== undefined) {
        studentUpdate.roll_no = rollNumber;
      }
      if (school_academic_year_id !== undefined) {
        studentUpdate.school_academic_year_id = school_academic_year_id;
      }

      await queryRunner.manager.update(Student, studentId, studentUpdate);

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private formatStudentResponse(st: Student) {
    return {
      id: String(st.id),
      school_id: st.school_id,
      school_academic_year_id: st.school_academic_year_id,
      academic_year_id: st.school_academic_year?.academic_year_id,
      user_id: st.user_id,
      parent_user_id: st.parent_user_id,
      name: st.user ? st.user.name : "",
      email: st.user ? st.user.email : "",
      phone: st.user ? st.user.phone || "" : "",
      class_id: st.class_id ? String(st.class_id) : "",
      class_name: st.class ? st.class.name : "",
      class: st.class ? st.class.name : "",
      division_master_id: st.division_master_id ? String(st.division_master_id) : "",
      division_id: st.division_master_id ? String(st.division_master_id) : "",
      division_name: st.division_master ? st.division_master.name : (st.class ? st.class.division || "" : ""),
      caste_master_id: st.caste_master_id ? String(st.caste_master_id) : "",
      caste_name: st.caste_master ? st.caste_master.name : "",
      caste_code: st.caste_master ? st.caste_master.code : "",
      caste_category: st.caste_category || (st.caste_master ? st.caste_master.name : ""),
      registration_no: st.registration_no || "",
      academic_year: st.academic_year || "",
      aadhar_no: st.aadhar_no || "",
      medium: st.medium || "",
      father_name: st.father_name || st.guardian_name || "",
      father_occupation: st.father_occupation || "",
      father_qualification: st.father_qualification || "",
      mother_name: st.mother_name || "",
      mother_occupation: st.mother_occupation || "",
      mother_qualification: st.mother_qualification || "",
      whatsapp_no: st.whatsapp_no || "",
      scholar_no: st.scholar_no || "",
      roll_no: st.roll_no || "",
      rollNumber: st.roll_no || "",
      dob: st.dob || "",
      dateOfBirth: st.dob || "",
      gender: st.gender || "other",
      blood_group: st.blood_group || "",
      bloodGroup: st.blood_group || "",
      address: st.address || "",
      guardian_name: st.guardian_name || st.father_name || "",
      guardian_phone: st.guardian_phone || "",
      parent_name: st.guardian_name || st.father_name || "",
      parentName: st.guardian_name || st.father_name || "",
      parent_phone: st.guardian_phone || "",
      parentPhone: st.guardian_phone || "",
      admission_date: st.admission_date || "",
      admissionDate: st.admission_date || "",
      created_at: st.created_at,
      updated_at: st.updated_at,
    };
  }

  async deleteStudent(userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get student record to inspect guardian details
      const student = await queryRunner.manager.findOne(Student, { where: { user_id: userId } });

      // 2. Soft delete student user
      await queryRunner.manager.update(User, userId, { is_active: false });

      // 3. Deactivate associated parent user ONLY if no other active students remain with this parent
      if (student) {
        const guardianPhone = student.guardian_phone;
        const guardianName = student.guardian_name;

        const otherActiveStudents = await queryRunner.manager
          .createQueryBuilder(Student, "st")
          .innerJoin("st.user", "u")
          .where("st.id != :studentId", { studentId: student.id })
          .andWhere("u.is_active = :isActive", { isActive: true })
          .andWhere(
            "( (st.guardian_phone IS NOT NULL AND st.guardian_phone = :phone) OR (st.guardian_name IS NOT NULL AND st.guardian_name = :name) )",
            { phone: guardianPhone || "", name: guardianName || "" }
          )
          .getCount();

        if (otherActiveStudents === 0) {
          let parentUser: User | null = null;
          if (guardianPhone) {
            parentUser = await queryRunner.manager.findOne(User, {
              where: { phone: guardianPhone, role: UserRole.PARENT },
            });
          }
          if (!parentUser && guardianName) {
            parentUser = await queryRunner.manager.findOne(User, {
              where: { name: guardianName, role: UserRole.PARENT },
            });
          }
          if (!parentUser) {
            parentUser = await queryRunner.manager.findOne(User, {
              where: { email: `parent_${userId}@school.com` },
            });
          }

          if (parentUser) {
            await queryRunner.manager.update(User, parentUser.id, { is_active: false });
          }

          await queryRunner.manager.update(Student, student.id, { is_deleted: true });
        } else {
          await queryRunner.manager.update(Student, student.id, { is_deleted: true });
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkCreateStudents(
    schoolId: number,
    academicYearHeader: string | undefined,
    students: Array<any>
  ) {
    const results = {
      addedCount: 0,
      skippedCount: 0,
      errors: [] as Array<{ email: string; reason: string }>,
    };

    let sayId = null;
    if (!sayId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    const classNextRollMap = new Map<number, number>();
    for (const st of students) {
      const name = st.name;
      const email = st.email ? String(st.email).trim().toLowerCase() : "";
      const className = st.class || st.className;
      const section = st.section || st.division || "A";
      let rollNumber = st.rollNumber || st.roll_no;
      const parentName = st.parentName || st.guardian_name || st.parent_name || st.parentname || st.father_name || st.fatherName;
      const parentPhone = st.parentPhone || st.guardian_phone || st.parent_phone || st.parentphone;
      const dateOfBirth = st.dateOfBirth || st.dob;
      const bloodGroup = st.bloodGroup || st.blood_group;
      const admissionDate = st.admissionDate || st.admission_date;
      const rawGender = st.gender ? String(st.gender).trim().toLowerCase() : "";
      const address = st.address;
      const rawDivision = st.division_master_id || st.divisionMasterId || st.division || st.section || section;
      const schoolAcademicYearId = st.school_academic_year_id || st.schoolAcademicYearId;

      const casteCategory = st.caste_category || st.casteCategory || st.caste;
      const subCaste = st.sub_caste || st.subCaste;
      const registrationNo = st.registration_no || st.registrationNo;
      const academicYear = st.academic_year || st.academicYear;
      const aadharNo = st.aadhar_no || st.aadharNo;
      const medium = st.medium;
      const fatherName = st.father_name || st.fatherName;
      const fatherOccupation = st.father_occupation || st.fatherOccupation;
      const fatherQualification = st.father_qualification || st.fatherQualification;
      const motherName = st.mother_name || st.motherName;
      const motherOccupation = st.mother_occupation || st.motherOccupation;
      const motherQualification = st.mother_qualification || st.motherQualification;
      const whatsappNo = st.whatsapp_no || st.whatsappNo;
      const scholarNo = st.scholar_no || st.scholarNo;

      if (!name || !className || !section || !parentName) {
        results.skippedCount++;
        const missing = [];
        if (!name) missing.push("Name");
        if (!className) missing.push("Class");
        if (!section) missing.push("Section/Division");
        if (!parentName) missing.push("Parent Name");
        results.errors.push({ email: email || "N/A", reason: `${missing.join(", ")} required` });
        continue;
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.skippedCount++;
          results.errors.push({ email, reason: "Invalid email format" });
          continue;
        }
      }

      if (parentPhone && !/^[6-9]\d{9}$/.test(String(parentPhone).trim())) {
        results.skippedCount++;
        results.errors.push({ email: email || "N/A", reason: "Guardian phone must be a valid 10-digit number starting with 6-9" });
        continue;
      }

      // 1. Resolve Class
      let classId: number | undefined = st.classId || st.class_id;
      if (!classId && className) {
        classId = await this.getOrCreateClass(schoolId, className, section, sayId);
      }

      // 2. Resolve DivisionMasterId from Division Name or Code
      let divisionMasterId: number | undefined = undefined;
      if (rawDivision) {
        if (!isNaN(Number(rawDivision))) {
          divisionMasterId = Number(rawDivision);
        } else {
          const divMaster = await this.divisionMasterRepo.createQueryBuilder("dm")
            .where("LOWER(dm.name) = LOWER(:d) OR LOWER(dm.code) = LOWER(:d)", { d: String(rawDivision).trim() })
            .getOne();
          if (divMaster) {
            divisionMasterId = divMaster.id;
          }
        }
      }

      // 3. Resolve CasteMasterId from Caste Category Name/Code
      let casteMasterId: number | undefined = st.caste_master_id || st.casteMasterId;
      if (!casteMasterId && casteCategory) {
        const casteMatch = await this.casteMasterRepo.createQueryBuilder("cm")
          .where("LOWER(cm.name) = LOWER(:c) OR LOWER(cm.code) = LOWER(:c)", { c: String(casteCategory).trim() })
          .getOne();
        if (casteMatch) {
          casteMasterId = casteMatch.id;
        }
      }

      // 4. Normalize Gender (m / Male / male -> male; f / Female / female -> female; o / Other / other -> other)
      let normalizedGender = "male";
      if (rawGender === "m" || rawGender === "male") {
        normalizedGender = "male";
      } else if (rawGender === "f" || rawGender === "female") {
        normalizedGender = "female";
      } else if (rawGender === "o" || rawGender === "other") {
        normalizedGender = "other";
      }

      // 5. Auto-generate or validate Roll Number
      if (classId) {
        if (!rollNumber) {
          let nextRoll = classNextRollMap.get(classId);
          if (nextRoll === undefined) {
            const maxRollStudent = await this.studentRepo.createQueryBuilder("st")
              .where("st.school_id = :schoolId", { schoolId })
              .andWhere("st.class_id = :classId", { classId })
              .andWhere("st.is_deleted = :isDeleted", { isDeleted: false })
              .andWhere("st.roll_no ~ '^[0-9]+$'")
              .orderBy("CAST(st.roll_no AS INTEGER)", "DESC")
              .getOne();

            const currentDbMax = maxRollStudent && maxRollStudent.roll_no ? parseInt(maxRollStudent.roll_no, 10) : 0;
            nextRoll = currentDbMax + 1;
          }
          rollNumber = String(nextRoll).padStart(4, "0");
          classNextRollMap.set(classId, nextRoll + 1);
        } else {
          // If explicit rollNumber was provided, update classNextRollMap if numeric
          const numRoll = parseInt(String(rollNumber), 10);
          if (!isNaN(numRoll)) {
            const currNext = classNextRollMap.get(classId) || 1;
            if (numRoll >= currNext) {
              classNextRollMap.set(classId, numRoll + 1);
            }
          }
        }
      }

      // 6. Check duplicate roll number if specified explicitly or generated
      if (classId && rollNumber) {
        const rollExists = await this.checkRollNumberExists(schoolId, classId, String(rollNumber));
        if (rollExists) {
          results.skippedCount++;
          results.errors.push({ email: email || "N/A", reason: `Roll number ${rollNumber} already exists in class` });
          continue;
        }
      }

      const parentEmail = st.parentEmail || st.parent_email;

      try {
        await this.createStudent(schoolId, academicYearHeader, {
          name: String(name).trim(),
          email: email ? String(email).trim() : undefined,
          phone: st.phone ? String(st.phone).trim() : undefined,
          classId,
          divisionMasterId,
          casteMasterId,
          casteCategory: subCaste || casteCategory ? String(subCaste || casteCategory).trim() : undefined,
          registrationNo: registrationNo ? String(registrationNo).trim() : undefined,
          academicYear: academicYear ? String(academicYear).trim() : undefined,
          aadharNo: aadharNo ? String(aadharNo).trim() : undefined,
          medium: medium ? String(medium).trim() : undefined,
          fatherName: fatherName ? String(fatherName).trim() : undefined,
          fatherOccupation: fatherOccupation ? String(fatherOccupation).trim() : undefined,
          fatherQualification: fatherQualification ? String(fatherQualification).trim() : undefined,
          motherName: motherName ? String(motherName).trim() : undefined,
          motherOccupation: motherOccupation ? String(motherOccupation).trim() : undefined,
          motherQualification: motherQualification ? String(motherQualification).trim() : undefined,
          whatsappNo: whatsappNo ? String(whatsappNo).trim() : undefined,
          scholarNo: scholarNo ? String(scholarNo).trim() : undefined,
          rollNumber: rollNumber ? String(rollNumber).trim() : undefined,
          parentName: parentName ? String(parentName).trim() : undefined,
          parentPhone: parentPhone ? String(parentPhone).trim() : undefined,
          parentEmail: parentEmail ? String(parentEmail).trim() : undefined,
          address: address ? String(address).trim() : undefined,
          dateOfBirth,
          gender: normalizedGender,
          bloodGroup,
          admissionDate,
          school_academic_year_id: schoolAcademicYearId ? Number(schoolAcademicYearId) : undefined,
        });
        results.addedCount++;
      } catch (err: any) {
        results.skippedCount++;
        results.errors.push({ email: email || "N/A", reason: err.message || "Failed to create student" });
      }
    }

    return results;
  }
}

