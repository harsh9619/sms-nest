import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Class } from "../../entities/class.entity.js";
import { ClassMaster } from "../../entities/class-master.entity.js";
import { Subject } from "../../entities/subject.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";
import { toIntID } from "../../db/index.js";

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(ClassMaster)
    private classMasterRepo: Repository<ClassMaster>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private ayService: AcademicYearService,
    private dataSource: DataSource
  ) {}

  async resolveClassMasterId(
    className: string,
    explicitMasterId?: number | null
  ): Promise<number | null> {
    if (explicitMasterId) return explicitMasterId;
    if (!className) return null;

    const trimmedName = className.trim();
    const cmLabel = isNaN(Number(trimmedName)) ? trimmedName : `Class ${trimmedName}`;

    const master = await this.classMasterRepo
      .createQueryBuilder("cm")
      .where("LOWER(cm.name) = LOWER(:cmLabel) OR LOWER(cm.name) = LOWER(:trimmedName)", {
        cmLabel,
        trimmedName,
      })
      .getOne();

    return master ? master.id : null;
  }

  async getClasses(schoolId: number | null, headerVal: number | null) {
    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, headerVal);
    }

    const qb = this.classRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.teacher", "t")
      .leftJoinAndSelect("c.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("c.school_id = :schoolId", { schoolId });
    }
    if (sayId) {
      qb.andWhere("c.school_academic_year_id = :sayId", { sayId });
    }

    qb.orderBy("c.name", "ASC").addOrderBy("c.section", "ASC");

    const classes = await qb.getMany();

    return Promise.all(
      classes.map(async (cls) => {
        const studentCountRes = await this.classRepo.query(
          `SELECT COUNT(*)::int AS count FROM students WHERE class_id = $1`,
          [cls.id]
        );
        const subjectsRes = await this.classRepo.query(
          `SELECT ARRAY_AGG(name) AS subjects FROM subjects WHERE class_id = $1`,
          [cls.id]
        );

        return {
          id: String(cls.id),
          name: cls.name,
          section: cls.section,
          teacherId: cls.teacher_id ? String(cls.teacher_id) : null,
          teacherName: cls.teacher ? cls.teacher.name : null,
          studentCount: studentCountRes[0]?.count || 0,
          subjects: subjectsRes[0]?.subjects || [],
          schoolId: String(cls.school_id),
          academicYearId: cls.school_academic_year_id ? String(cls.school_academic_year_id) : null,
          academicYear: cls.school_academic_year?.academic_year?.label || null,
          classMasterId: cls.class_master_id ? String(cls.class_master_id) : null,
        };
      })
    );
  }

  async getClassById(classId: number) {
    return this.classRepo.findOne({ where: { id: classId } });
  }

  async getFullClassRecord(classId: number) {
    const classes = await this.getClasses(null, null);
    return classes.find((c) => Number(c.id) === classId) || null;
  }

  async createClass(schoolId: number, data: any, headerVal?: string | number | null) {
    const { name, section, teacherId, subjects, classMasterId, schoolAcademicYearId, academicYear } = data;
    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    const finalSayId = await this.ayService.getSchoolAcademicYearId(
      schoolId,
      headerVal || schoolAcademicYearId || academicYear
    );
    const finalClassMasterId = await this.resolveClassMasterId(
      name,
      classMasterId ? toIntID(String(classMasterId)) : null
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newClass = queryRunner.manager.create(Class, {
        school_id: schoolId,
        school_academic_year_id: finalSayId,
        class_master_id: finalClassMasterId,
        name,
        section,
        teacher_id: dbTeacherId,
      });
      const savedClass = await queryRunner.manager.save(Class, newClass);

      if (subjects && Array.isArray(subjects)) {
        for (const sub of subjects) {
          const cleanSub = String(sub).trim();
          if (!cleanSub) continue;

          const newSub = queryRunner.manager.create(Subject, {
            school_id: schoolId,
            name: cleanSub,
            code: cleanSub.toUpperCase(),
            class_id: savedClass.id,
            teacher_id: dbTeacherId,
          });
          await queryRunner.manager.save(Subject, newSub);
        }
      }

      await queryRunner.commitTransaction();
      return savedClass.id;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateClass(
    classId: number,
    schoolId: number,
    data: any,
    headerVal?: string | number | null
  ) {
    const { name, section, teacherId, subjects, classMasterId, schoolAcademicYearId, academicYear } = data;
    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    const finalSayId = await this.ayService.getSchoolAcademicYearId(
      schoolId,
      headerVal || schoolAcademicYearId || academicYear
    );
    const finalClassMasterId = await this.resolveClassMasterId(
      name,
      classMasterId ? toIntID(String(classMasterId)) : null
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Class, classId, {
        name,
        section,
        teacher_id: dbTeacherId,
        school_academic_year_id: finalSayId,
        class_master_id: finalClassMasterId,
      });

      if (subjects && Array.isArray(subjects)) {
        const cleanSubjects = subjects.map((s: any) => String(s).trim()).filter(Boolean);
        const existingSubjects = await queryRunner.manager.find(Subject, {
          where: { class_id: classId },
        });
        const existingNames = existingSubjects.map((s) => s.name);

        const toDelete = existingSubjects.filter((s) => !cleanSubjects.includes(s.name));
        for (const sub of toDelete) {
          await queryRunner.manager.delete(Subject, sub.id);
        }

        const toAdd = cleanSubjects.filter((n) => !existingNames.includes(n));
        for (const sub of toAdd) {
          const newSub = queryRunner.manager.create(Subject, {
            school_id: schoolId,
            name: sub,
            code: sub.toUpperCase(),
            class_id: classId,
            teacher_id: dbTeacherId,
          });
          await queryRunner.manager.save(Subject, newSub);
        }

        await queryRunner.manager.update(Subject, { class_id: classId }, { teacher_id: dbTeacherId });
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteClass(classId: number) {
    await this.classRepo.delete(classId);
  }

  async getClassMasters() {
    return this.classMasterRepo.find({ order: { grade_level: "ASC" } });
  }

  async createClassesBatch(
    schoolId: number,
    items: { name: string; section: string; teacherId?: number | null; classMasterId?: number | null }[],
    headerVal?: number | null
  ) {
    const createdClasses: any[] = [];
    const finalSayId = await this.ayService.getSchoolAcademicYearId(schoolId, headerVal);

    for (const item of items) {
      const { name, section, teacherId, classMasterId } = item;
      const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;
      const finalClassMasterId = await this.resolveClassMasterId(
        name,
        classMasterId ? toIntID(String(classMasterId)) : null
      );

      let existing = await this.classRepo.findOne({
        where: {
          school_id: schoolId,
          name,
          section,
          school_academic_year_id: finalSayId || undefined,
        },
      });

      if (existing) {
        createdClasses.push({
          id: String(existing.id),
          name: existing.name,
          section: existing.section,
          schoolAcademicYearId: existing.school_academic_year_id ? String(existing.school_academic_year_id) : null,
          classMasterId: existing.class_master_id ? String(existing.class_master_id) : null,
        });
        continue;
      }

      const newCls = this.classRepo.create({
        school_id: schoolId,
        school_academic_year_id: finalSayId,
        class_master_id: finalClassMasterId,
        name,
        section,
        teacher_id: dbTeacherId,
      });

      const saved = await this.classRepo.save(newCls);
      createdClasses.push({
        id: String(saved.id),
        name: saved.name,
        section: saved.section,
        schoolAcademicYearId: saved.school_academic_year_id ? String(saved.school_academic_year_id) : null,
        classMasterId: saved.class_master_id ? String(saved.class_master_id) : null,
      });
    }

    return createdClasses;
  }
}
