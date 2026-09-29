import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";

@Injectable()
export class AcademicYearService {
  constructor(
    @InjectRepository(AcademicYear)
    private ayRepo: Repository<AcademicYear>,
    @InjectRepository(SchoolAcademicYear)
    private sayRepo: Repository<SchoolAcademicYear>,
    private dataSource: DataSource
  ) {}

  async getSchoolAcademicYearId(
    schoolId?: number | null,
    headerVal?: string | number | null
  ): Promise<number | null> {
    const parsedInt = headerVal ? parseInt(String(headerVal), 10) : null;
    const headerStr = headerVal ? String(headerVal).trim() : null;

    if (headerStr) {
      const qb = this.sayRepo
        .createQueryBuilder("say")
        .leftJoin("say.academic_year", "ay");

      if (schoolId) {
        qb.where("say.school_id = :schoolId", { schoolId });
      }

      if (parsedInt && !isNaN(parsedInt)) {
        qb.andWhere(
          "(say.id = :parsedInt OR say.academic_year_id = :parsedInt OR ay.label = :headerStr)",
          { parsedInt, headerStr }
        );
      } else {
        qb.andWhere("ay.label = :headerStr", { headerStr });
      }

      const found = await qb.select("say.id", "id").getRawOne();
      if (found) {
        return Number(found.id);
      }
    }

    const whereClause: any = {};
    if (schoolId) {
      whereClause.school_id = schoolId;
    }

    const fallback = await this.sayRepo.findOne({
      where: whereClause,
      order: { is_current: "DESC", id: "DESC" },
    });

    return fallback ? fallback.id : null;
  }

  async getMasterAcademicYears() {
    const list = await this.ayRepo.find({
      order: { label: "DESC" },
    });
    return list.map((item) => ({
      id: String(item.id),
      label: item.label,
      startDate: item.start_date,
      endDate: item.end_date,
    }));
  }

  async getAcademicYears(schoolId?: number) {
    const qb = this.sayRepo
      .createQueryBuilder("say")
      .innerJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.where("say.school_id = :schoolId", { schoolId });
    }

    qb.orderBy("say.is_current", "DESC").addOrderBy("ay.start_date", "DESC");

    const list = await qb.getMany();
    return list.map((item) => ({
      id: String(item.id),
      label: item.academic_year.label,
      startDate: item.academic_year.start_date,
      endDate: item.academic_year.end_date,
      isCurrent: item.is_current,
      schoolId: String(item.school_id),
    }));
  }

  async getAcademicYearById(id: number) {
    const item = await this.sayRepo.findOne({
      where: { id },
      relations: { academic_year: true },
    });

    if (!item) return null;

    return {
      id: String(item.id),
      label: item.academic_year.label,
      startDate: item.academic_year.start_date,
      endDate: item.academic_year.end_date,
      isCurrent: item.is_current,
      schoolId: String(item.school_id),
    };
  }

  async getCurrentAcademicYear(schoolId: number) {
    const item = await this.sayRepo.findOne({
      where: { school_id: schoolId, is_current: true },
      relations: { academic_year: true },
    });

    if (!item) return null;

    return {
      id: String(item.id),
      label: item.academic_year.label,
      startDate: item.academic_year.start_date,
      endDate: item.academic_year.end_date,
      isCurrent: item.is_current,
      schoolId: String(item.school_id),
    };
  }

  async createAcademicYear(schoolId: number, data: any) {
    const { label, startDate, endDate, isCurrent = false } = data;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (isCurrent) {
        await queryRunner.manager.update(
          SchoolAcademicYear,
          { school_id: schoolId },
          { is_current: false }
        );
      }

      let ay = await queryRunner.manager.findOne(AcademicYear, {
        where: { label },
      });
      if (!ay) {
        ay = queryRunner.manager.create(AcademicYear, {
          label,
          start_date: startDate,
          end_date: endDate,
        });
        ay = await queryRunner.manager.save(AcademicYear, ay);
      }

      let say = queryRunner.manager.create(SchoolAcademicYear, {
        school_id: schoolId,
        academic_year_id: ay.id,
        is_current: Boolean(isCurrent),
      });
      say = await queryRunner.manager.save(SchoolAcademicYear, say);

      await queryRunner.commitTransaction();
      return this.getAcademicYearById(say.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateAcademicYear(id: number, schoolId: number, data: any) {
    const { label, startDate, endDate, isCurrent = false } = data;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (isCurrent) {
        await queryRunner.manager.update(
          SchoolAcademicYear,
          { school_id: schoolId },
          { is_current: false }
        );
      }

      const say = await queryRunner.manager.findOne(SchoolAcademicYear, {
        where: { id },
      });
      if (say) {
        say.is_current = Boolean(isCurrent);
        await queryRunner.manager.save(SchoolAcademicYear, say);

        await queryRunner.manager.update(AcademicYear, say.academic_year_id, {
          label,
          start_date: startDate,
          end_date: endDate,
        });
      }

      await queryRunner.commitTransaction();
      return this.getAcademicYearById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAcademicYear(id: number) {
    const say = await this.getAcademicYearById(id);
    if (say) {
      await this.sayRepo.delete(id);
    }
    return say;
  }
}
