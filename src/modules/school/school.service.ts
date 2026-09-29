import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { School } from "../../entities/school.entity.js";
import { MasterTheme } from "../../entities/master-theme.entity.js";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(School)
    private schoolRepo: Repository<School>,
    @InjectRepository(MasterTheme)
    private themeRepo: Repository<MasterTheme>,
    @InjectRepository(AcademicYear)
    private ayRepo: Repository<AcademicYear>,
    @InjectRepository(SchoolAcademicYear)
    private sayRepo: Repository<SchoolAcademicYear>
  ) {}

  async getSchools(schoolId?: number, search?: string, user?: any) {
    const query = this.schoolRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.academic_years", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .orderBy("s.name", "ASC")
      .addOrderBy("say.is_current", "DESC")
      .addOrderBy("say.id", "ASC");

    if (schoolId) {
      query.andWhere("s.id = :schoolId", { schoolId });
    } else if (user && user.role !== "admin" && user.role !== "super_admin" && user.schoolId) {
      query.andWhere("s.id = :userSchoolId", { userSchoolId: Number(user.schoolId) });
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

  async createSchool(data: Partial<School> & Record<string, any>) {
    const academicYearLabel = (
      data.academic_year ||
      data.academicYear ||
      "2025-2026"
    ).trim();

    const schoolPayload: Partial<School> = {
      name: data.name,
      slug: data.slug,
      address: data.address,
      phone: data.phone,
      email: data.email,
      logo_url: data.logo_url || data.logoUrl,
      board: data.board || data.type,
      academic_year: academicYearLabel,
      is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
      subscription: data.subscription || "basic",
      max_students: data.max_students || data.maxStudents || 500,
      theme: data.theme || "default",
      appearance_mode: data.appearance_mode || data.appearanceMode || "light",
    };

    const newSchool = this.schoolRepo.create(schoolPayload);
    const savedSchool = await this.schoolRepo.save(newSchool);

    if (academicYearLabel) {
      await this.ensureSchoolAcademicYearLink(savedSchool.id, academicYearLabel);
    }

    return this.getSchoolById(savedSchool.id);
  }

  async updateSchool(id: number, data: Partial<School> & Record<string, any>) {
    const academicYearLabel = (
      data.academic_year ||
      data.academicYear ||
      ""
    ).trim();

    const schoolPayload: Partial<School> = {};
    if (data.name !== undefined) schoolPayload.name = data.name;
    if (data.slug !== undefined) schoolPayload.slug = data.slug;
    if (data.address !== undefined) schoolPayload.address = data.address;
    if (data.phone !== undefined) schoolPayload.phone = data.phone;
    if (data.email !== undefined) schoolPayload.email = data.email;
    if (data.logo_url !== undefined || data.logoUrl !== undefined) schoolPayload.logo_url = data.logo_url || data.logoUrl;
    if (data.board !== undefined || data.type !== undefined) schoolPayload.board = data.board || data.type;
    if (academicYearLabel) schoolPayload.academic_year = academicYearLabel;
    if (data.is_active !== undefined || data.isActive !== undefined) schoolPayload.is_active = data.is_active !== undefined ? data.is_active : data.isActive;
    if (data.subscription !== undefined) schoolPayload.subscription = data.subscription;
    if (data.max_students !== undefined || data.maxStudents !== undefined) schoolPayload.max_students = data.max_students || data.maxStudents;
    if (data.theme !== undefined) schoolPayload.theme = data.theme;
    if (data.appearance_mode !== undefined || data.appearanceMode !== undefined) schoolPayload.appearance_mode = data.appearance_mode || data.appearanceMode;

    await this.schoolRepo.update(id, schoolPayload);

    if (academicYearLabel) {
      await this.ensureSchoolAcademicYearLink(id, academicYearLabel);
    }

    return this.getSchoolById(id);
  }

  private async ensureSchoolAcademicYearLink(schoolId: number, label: string) {
    let ay = await this.ayRepo.findOne({ where: { label } });
    if (!ay) {
      let startYear = parseInt(label.split("-")[0], 10);
      if (isNaN(startYear)) startYear = new Date().getFullYear();
      const endYear = startYear + 1;
      ay = this.ayRepo.create({
        label,
        start_date: `${startYear}-04-01`,
        end_date: `${endYear}-03-31`,
      });
      ay = await this.ayRepo.save(ay);
    }

    let say = await this.sayRepo.findOne({
      where: { school_id: schoolId, academic_year_id: ay.id },
    });

    if (!say) {
      await this.sayRepo.update({ school_id: schoolId }, { is_current: false });
      say = this.sayRepo.create({
        school_id: schoolId,
        academic_year_id: ay.id,
        is_current: true,
      });
      await this.sayRepo.save(say);
    } else if (!say.is_current) {
      await this.sayRepo.update({ school_id: schoolId }, { is_current: false });
      say.is_current = true;
      await this.sayRepo.save(say);
    }
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
