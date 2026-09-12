import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Student } from "../../entities/student.entity.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { Class } from "../../entities/class.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";

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
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

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
        "(LOWER(u.name) LIKE LOWER(:s) OR LOWER(u.email) LIKE LOWER(:s) OR LOWER(st.roll_no) LIKE LOWER(:s) OR LOWER(st.guardian_name) LIKE LOWER(:s))",
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

  async getStudentById(id: number) {
    const st = await this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.division_master", "dm")
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
      .andWhere("u.school_id = :schoolId", { schoolId });

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
      .andWhere("st.roll_no = :rollNumber", { rollNumber });

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

  async getOrCreateClass(schoolId: number, className: string, section: string) {
    let cls = await this.classRepo.findOne({
      where: { school_id: schoolId, name: className, division: section },
    });

    if (!cls) {
      cls = this.classRepo.create({
        school_id: schoolId,
        name: className,
        division: section,
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

      const newUser = queryRunner.manager.create(User, {
        school_id: schoolId,
        name,
        email: email.toLowerCase(),
        password: "password123",
        role: UserRole.STUDENT,
        phone: phone || null,
      });
      const savedUser = await queryRunner.manager.save(User, newUser);

      const dobValue = dateOfBirth ? dateOfBirth : null;
      const admissionDateValue = admissionDate ? admissionDate : null;
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      const newStudent = queryRunner.manager.create(Student, {
        school_id: schoolId,
        school_academic_year_id: sayId || null,
        user_id: savedUser.id,
        class_id: classId || null,
        division_master_id: divisionMasterId || null,
        roll_no: rollNumber || null,
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

      await queryRunner.manager.update(User, userId, {
        name,
        email: email ? email.toLowerCase() : undefined,
        phone: phone !== undefined ? phone : undefined,
      });

      const dobValue = dateOfBirth ? dateOfBirth : null;
      const admissionDateValue = admissionDate ? admissionDate : null;
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      const studentUpdate: any = {
        gender: genderValue,
        dob: dobValue,
        guardian_name: parentName !== undefined ? parentName : undefined,
        guardian_phone: parentPhone !== undefined ? parentPhone : undefined,
        address: address !== undefined ? address : undefined,
        blood_group: bloodGroup !== undefined ? bloodGroup : undefined,
        admission_date: admissionDateValue,
      };

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
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteStudent(userId: number) {
    await this.userRepo.delete(userId);
  }

  private formatStudentResponse(st: Student) {
    return {
      id: String(st.id),
      school_id: st.school_id,
      school_academic_year_id: st.school_academic_year_id,
      academic_year_id: st.school_academic_year?.academic_year_id,
      user_id: st.user_id,
      name: st.user ? st.user.name : "",
      email: st.user ? st.user.email : "",
      phone: st.user ? st.user.phone || "" : "",
      class_id: st.class_id ? String(st.class_id) : "",
      class_name: st.class ? st.class.name : "",
      class: st.class ? st.class.name : "",
      division_master_id: st.division_master_id ? String(st.division_master_id) : "",
      division_id: st.division_master_id ? String(st.division_master_id) : "",
      division_name: st.division_master ? st.division_master.name : (st.class ? st.class.division || "" : ""),
      roll_no: st.roll_no || "",
      rollNumber: st.roll_no || "",
      dob: st.dob || "",
      dateOfBirth: st.dob || "",
      gender: st.gender || "other",
      blood_group: st.blood_group || "",
      bloodGroup: st.blood_group || "",
      address: st.address || "",
      guardian_name: st.guardian_name || "",
      guardian_phone: st.guardian_phone || "",
      parent_name: st.guardian_name || "",
      parentName: st.guardian_name || "",
      parent_phone: st.guardian_phone || "",
      parentPhone: st.guardian_phone || "",
      admission_date: st.admission_date || "",
      admissionDate: st.admission_date || "",
      created_at: st.created_at,
      updated_at: st.updated_at,
    };
  }
}

