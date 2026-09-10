import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { User } from "../../entities/user.entity.js";
import { Student } from "../../entities/student.entity.js";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private dataSource: DataSource
  ) {}

  async getUsers(schoolId: number | null, showAll: boolean) {
    const qb = this.userRepo
      .createQueryBuilder("u")
      .leftJoinAndSelect("u.school", "s");

    if (schoolId && !showAll) {
      qb.where("u.school_id = :schoolId", { schoolId });
    }

    qb.orderBy("u.created_at", "DESC");

    const users = await qb.getMany();
    return users.map((u) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role === "school_admin" || u.role === "super_admin" ? "admin" : u.role,
      schoolId: u.school_id ? String(u.school_id) : null,
      schoolName: u.school ? u.school.name : null,
      avatar: u.avatar_url,
      isActive: u.is_active,
    }));
  }

  async getUserById(userId: number) {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async getFullUserRecord(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { school: true },
    });

    if (!user) return null;

    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role === "school_admin" || user.role === "super_admin" ? "admin" : user.role,
      schoolId: user.school_id ? String(user.school_id) : null,
      schoolName: user.school ? user.school.name : null,
      avatar: user.avatar_url,
      isActive: user.is_active,
    };
  }

  async createUser(data: any) {
    const { name, email, phone, dbRole, schoolId } = data;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newUser = queryRunner.manager.create(User, {
        school_id: schoolId,
        name,
        email: email.toLowerCase(),
        password: "password123",
        role: dbRole,
        phone: phone || null,
      });

      const savedUser = await queryRunner.manager.save(User, newUser);

      if (dbRole === "student") {
        const newStudent = queryRunner.manager.create(Student, {
          school_id: schoolId,
          user_id: savedUser.id,
          roll_no: "N/A",
          gender: "other",
        });
        await queryRunner.manager.save(Student, newStudent);
      }

      await queryRunner.commitTransaction();
      return savedUser.id;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateUser(userId: number, data: any) {
    const { name, email, phone, dbRole, schoolId } = data;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(User, userId, {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        role: dbRole,
        school_id: schoolId,
      });

      const studentRecord = await queryRunner.manager.findOne(Student, {
        where: { user_id: userId },
      });

      if (dbRole === "student") {
        if (!studentRecord) {
          const newStudent = queryRunner.manager.create(Student, {
            school_id: schoolId,
            user_id: userId,
            roll_no: "N/A",
            gender: "other",
          });
          await queryRunner.manager.save(Student, newStudent);
        } else {
          await queryRunner.manager.update(Student, { user_id: userId }, { school_id: schoolId });
        }
      } else if (studentRecord) {
        await queryRunner.manager.delete(Student, { user_id: userId });
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteUser(userId: number) {
    await this.userRepo.delete(userId);
  }
}
