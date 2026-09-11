import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { School } from "../../entities/school.entity.js";
import { MasterTheme } from "../../entities/master-theme.entity.js";

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(School)
    private schoolRepo: Repository<School>,
    @InjectRepository(MasterTheme)
    private themeRepo: Repository<MasterTheme>
  ) {}

  async getSchools(schoolId?: number, search?: string) {
    const query = this.schoolRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.academic_years", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .orderBy("s.name", "ASC")
      .addOrderBy("say.is_current", "DESC")
      .addOrderBy("say.id", "ASC");

    if (schoolId) {
      query.andWhere("s.id = :schoolId", { schoolId });
    }

    if (search) {
      query.andWhere(
        "(s.name ILIKE :search OR s.slug ILIKE :search OR s.email ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    const schools = await query.getMany();
    return schools.map((school) => {
      const currentAcademicYear = school.academic_years?.find(
        (academicYear) => academicYear.is_current
      ) ?? school.academic_years?.[0];

      return {
        id: String(school.id),
        name: school.name,
        slug: school.slug,
        address: school.address,
        phone: school.phone,
        email: school.email,
        type: school.board,
        logoUrl: school.logo_url,
        theme: school.theme,
        appearanceMode: school.appearance_mode,
        isActive: school.is_active,
        subscription: school.subscription,
        maxStudents: school.max_students,
        academicYear:
          currentAcademicYear?.academic_year?.label ?? school.academic_year,
        schoolAcademicYearId: currentAcademicYear
          ? String(currentAcademicYear.id)
          : null,
        academicYears: (school.academic_years ?? []).map((academicYear) => ({
          schoolAcademicYearId: String(academicYear.id),
          academicYearId: String(academicYear.academic_year_id),
          academicYear: academicYear.academic_year?.label,
          isCurrent: academicYear.is_current,
          createdAt: academicYear.created_at,
        })),
        createdAt: school.created_at,
        updatedAt: school.updated_at,
      };
    });
  }

  async getSchoolById(id: number) {
    const school = await this.schoolRepo.findOne({
      where: { id },
      relations: { academic_years: { academic_year: true } },
    });
    return school;
  }

  async createSchool(data: Partial<School>) {
    const newSchool = this.schoolRepo.create(data);
    const savedSchool = await this.schoolRepo.save(newSchool);
    return this.getSchoolById(savedSchool.id);
  }

  async updateSchool(id: number, data: Partial<School>) {
    await this.schoolRepo.update(id, data);
    return this.getSchoolById(id);
  }

  async deleteSchool(id: number) {
    const school = await this.getSchoolById(id);
    if (school) {
      await this.schoolRepo.delete(id);
    }
    return school;
  }

  async getMasterThemes() {
    return this.themeRepo.find({
      where: { is_active: true },
      order: { sort_order: "ASC" },
    });
  }
}
