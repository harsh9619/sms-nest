import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "../../entities/user.entity.js";

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>
  ) {}

  async getTeachers(schoolId?: number) {
    const qb = this.userRepo
      .createQueryBuilder("u")
      .select([
        "u.id AS id",
        "u.name AS name",
        "u.email AS email",
        "u.phone AS phone",
        "u.avatar_url AS avatar",
        "u.created_at AS joinDate",
        "u.school_id AS schoolId",
      ])
      .where("u.role = :role", { role: UserRole.TEACHER });

    if (schoolId) {
      qb.andWhere("u.school_id = :schoolId", { schoolId });
    }

    const rawTeachers = await qb.getRawMany();

    return Promise.all(
      rawTeachers.map(async (t) => {
        const teacherId = t.id;
        const subRes = await this.userRepo.query(
          `SELECT string_agg(DISTINCT sm.name, ', ') AS subjects
           FROM school_subject_teachers sst
           JOIN subject_masters sm ON sm.id = sst.subject_master_id
           WHERE sst.teacher_id = $1`,
          [teacherId]
        );
        const salRes = await this.userRepo.query(
          `SELECT basic_salary::numeric::float AS salary FROM salary_structures ss WHERE ss.teacher_id = $1 AND ss.is_active = TRUE LIMIT 1`,
          [teacherId]
        );

        return {
          id: String(t.id),
          name: t.name,
          email: t.email,
          phone: t.phone,
          subject: subRes[0]?.subjects || "Mathematics",
          department: "Science",
          qualification: "B.Ed",
          experience: "5 years",
          avatar: t.avatar,
          joinDate: t.joindate ? new Date(t.joindate).toISOString() : null,
          salary: salRes[0]?.salary ? Number(salRes[0].salary) : 50000,
          schoolId: t.schoolid ? String(t.schoolid) : null,
        };
      })
    );
  }
}
