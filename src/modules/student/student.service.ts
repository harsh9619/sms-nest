import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Student } from "../../entities/student.entity.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { Class } from "../../entities/class.entity.js";

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    private dataSource: DataSource
  ) {}

  async getStudents(schoolId?: number, academicYear?: string) {
    const qb = this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("st.school_id = :schoolId", { schoolId });
    }
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }

    qb.orderBy("st.created_at", "DESC");

    const students = await qb.getMany();
    return students.map((st) => this.formatStudentResponse(st));
  }

  async getStudentById(id: number) {
    const st = await this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
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

  async getOrCreateClass(schoolId: number, className: string, section: string) {
    let cls = await this.classRepo.findOne({
      where: { school_id: schoolId, name: className, section },
    });

    if (!cls) {
      cls = this.classRepo.create({
        school_id: schoolId,
        name: className,
        section,
      });
      cls = await this.classRepo.save(cls);
    }

    return cls.id;
  }

  async createStudent(schoolId: number, data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
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
      } = data;

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
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      const newStudent = queryRunner.manager.create(Student, {
        school_id: schoolId,
        user_id: savedUser.id,
        class_id: classId,
        roll_no: rollNumber,
        dob: dobValue,
        gender: genderValue,
        blood_group: bloodGroup || null,
        address: address || null,
        guardian_name: parentName || null,
        guardian_phone: parentPhone || null,
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
    classId: number,
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
        rollNumber,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender,
        bloodGroup,
      } = data;

      await queryRunner.manager.update(User, userId, {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
      });

      const dobValue = dateOfBirth ? dateOfBirth : null;
      const genderValue = ["male", "female", "other"].includes(gender) ? gender : "other";

      await queryRunner.manager.update(Student, studentId, {
        class_id: classId,
        roll_no: rollNumber,
        dob: dobValue,
        gender: genderValue,
        blood_group: bloodGroup || null,
        address: address || null,
        guardian_name: parentName || null,
        guardian_phone: parentPhone || null,
      });

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
      id: st.id,
      school_id: st.school_id,
      user_id: st.user_id,
      name: st.user ? st.user.name : "",
      email: st.user ? st.user.email : "",
      phone: st.user ? st.user.phone : null,
      class_id: st.class_id,
      class_name: st.class ? st.class.name : "",
      section: st.class ? st.class.section : "",
      roll_no: st.roll_no,
      roll_number: st.roll_no,
      dob: st.dob,
      gender: st.gender,
      blood_group: st.blood_group,
      address: st.address,
      guardian_name: st.guardian_name,
      guardian_phone: st.guardian_phone,
      parent_name: st.guardian_name,
      parent_phone: st.guardian_phone,
      admission_date: st.admission_date,
      created_at: st.created_at,
    };
  }
}
