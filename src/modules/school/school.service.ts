import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
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
    const query = this.schoolRepo.createQueryBuilder("s");

    if (schoolId) {
      query.andWhere("s.id = :schoolId", { schoolId });
    }

    if (search) {
      query.andWhere(
        "(s.name ILIKE :search OR s.slug ILIKE :search OR s.email ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    query.orderBy("s.name", "ASC");
    return query.getMany();
  }

  async getSchoolById(id: number) {
    return this.schoolRepo.findOne({ where: { id } });
  }

  async createSchool(data: Partial<School>) {
    const newSchool = this.schoolRepo.create(data);
    return this.schoolRepo.save(newSchool);
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
