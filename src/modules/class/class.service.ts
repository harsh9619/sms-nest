import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ClassMaster } from "../../entities/class-master.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { SchoolClassSubject } from "../../entities/class-subject.entity.js";
import { SchoolClassTeacher } from "../../entities/class-teacher.entity.js";
import { SchoolSubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { DivisionMaster } from "../../entities/division-master.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";
import { toIntID } from "../../db/index.js";

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(SchoolClass)
    private schoolClassRepo: Repository<SchoolClass>,
    @InjectRepository(ClassMaster)
    private classMasterRepo: Repository<ClassMaster>,
    @InjectRepository(SubjectMaster)
    private subjectMasterRepo: Repository<SubjectMaster>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(SchoolClassTeacher)
    private schoolClassTeacherRepo: Repository<SchoolClassTeacher>,
    @InjectRepository(DivisionMaster)
    private divisionMasterRepo: Repository<DivisionMaster>,
    private ayService: AcademicYearService,
    private dataSource: DataSource
  ) { }

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

  async resolveDivisionMasterId(
    section: string | null | undefined,
    explicitMasterId?: number | null
  ): Promise<number | null> {
    if (explicitMasterId) return explicitMasterId;
    if (!section?.trim()) return null;

    const division = await this.divisionMasterRepo
      .createQueryBuilder("dm")
      .where("LOWER(dm.name) = LOWER(:section)", { section: section.trim() })
      .getOne();

    return division ? division.id : null;
  }

  async getClasses(schoolId: number | null, headerVal: number | null) {
    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, headerVal);
    }

    const scQb = this.schoolClassRepo
      .createQueryBuilder("sc")
      .leftJoinAndSelect("sc.class_teachers", "ct")
      .leftJoinAndSelect("ct.teacher", "t")
      .leftJoinAndSelect("sc.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .leftJoinAndSelect("sc.class_master", "cm")
      .leftJoinAndSelect("sc.division_master", "dm");

    if (schoolId) {
      scQb.andWhere("sc.school_id = :schoolId", { schoolId });
    }
    if (sayId) {
      scQb.andWhere("sc.school_academic_year_id = :sayId", { sayId });
    }

    scQb.orderBy("cm.grade_level", "ASC").addOrderBy("dm.id", "ASC");
    const schoolClasses = await scQb.getMany();

    const classResponses = await Promise.all(
      schoolClasses.map(async (sc) => {
        const classId = sc.id;
        const studentCountRes = await this.schoolClassRepo.query(
          `SELECT COUNT(*)::int AS count FROM students WHERE class_id = $1`,
          [classId]
        );
        const classMasterId = sc.class_master_id || null;
        const classDivisions = schoolClasses
          .filter((item) =>
            classMasterId
              ? item.class_master_id === classMasterId
              : item.name === sc.name
          )
          .map((item) => item.division_master)
          .filter(
            (division): division is NonNullable<typeof division> => Boolean(division)
          )
          .filter(
            (division, index, divisions) =>
              divisions.findIndex((item) => item.id === division.id) === index
          );

        const subjectsRes = await this.schoolClassRepo.query(
          `SELECT DISTINCT sm.id, sm.name
           FROM subject_masters sm
           JOIN school_class_subjects scs ON scs.subject_master_id = sm.id
           JOIN school_classes related_sc ON related_sc.id = scs.class_id
           WHERE related_sc.school_id = $1
             AND related_sc.school_academic_year_id IS NOT DISTINCT FROM $2
             AND (${classMasterId ? "related_sc.class_master_id = $3" : "related_sc.name = $3"})
           ORDER BY sm.name ASC`,
          [sc.school_id, sc.school_academic_year_id, classMasterId || sc.name]
        );

        const primaryTeacher = sc.class_teachers?.find((item) => item.is_primary) ?? sc.class_teachers?.[0];
        const teacherId = primaryTeacher?.teacher_id || null;
        const teacherName = primaryTeacher?.teacher?.name || null;

        return {
          id: String(classId),
          schoolClassId: String(sc.id),
          name: sc.name,
          section: sc.division || "",
          divisions: classDivisions.length
            ? classDivisions.map((division) => ({
                id: String(division.id),
                name: division.name,
              }))
            : sc.division
              ? [{ id: null, name: sc.division }]
              : [],
          division: sc.division || "",
          teacherId: teacherId ? String(teacherId) : null,
          teacherName: teacherName,
          studentCount: studentCountRes[0]?.count || 0,
          subjects: subjectsRes.map((subject: { id: number; name: string }) => ({
            id: String(subject.id),
            name: subject.name,
          })),
          schoolId: String(sc.school_id),
          academicYearId: sc.school_academic_year_id ? String(sc.school_academic_year_id) : null,
          academicYear: sc.school_academic_year?.academic_year?.label || null,
          classMasterId: sc.class_master_id ? String(sc.class_master_id) : null,
        };
      })
    );

    const uniqueClasses = new Map<string, (typeof classResponses)[number]>();

    for (const classResponse of classResponses) {
      const classKey = classResponse.classMasterId || classResponse.name;
      const existing = uniqueClasses.get(classKey);

      if (!existing) {
        uniqueClasses.set(classKey, classResponse);
        continue;
      }

      existing.divisions = Array.from(
        new Map(
          [...existing.divisions, ...classResponse.divisions].map((division) => [
            division.id ?? division.name,
            division,
          ])
        ).values()
      );
      existing.subjects = Array.from(
        new Map(
          [...existing.subjects, ...classResponse.subjects].map((subject) => [
            subject.id,
            subject,
          ])
        ).values()
      );
      existing.studentCount += classResponse.studentCount;

      if (!existing.teacherId && classResponse.teacherId) {
        existing.teacherId = classResponse.teacherId;
        existing.teacherName = classResponse.teacherName;
      }
    }

    return Array.from(uniqueClasses.values());
  }

  async getClassById(classId: number) {
    return this.schoolClassRepo.findOne({ where: { id: classId } });
  }

  async getFullClassRecord(classId: number) {
    const classes = await this.getClasses(null, null);
    return classes.find((c) => Number(c.id) === classId) || null;
  }

  async createClass(schoolId: number, data: any, headerVal?: string | number | null) {
    const { name, section, teacherId, subjects, classMasterId, divisionMasterId, schoolAcademicYearId, academicYear } = data;
    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    const finalSayId = await this.ayService.getSchoolAcademicYearId(
      schoolId,
      headerVal || schoolAcademicYearId || academicYear
    );
    const finalClassMasterId = await this.resolveClassMasterId(
      name,
      classMasterId ? toIntID(String(classMasterId)) : null
    );
    const finalDivisionMasterId = await this.resolveDivisionMasterId(
      section,
      divisionMasterId ? toIntID(String(divisionMasterId)) : null
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newSchoolClass = queryRunner.manager.create(SchoolClass, {
        school_id: schoolId,
        school_academic_year_id: finalSayId,
        class_master_id: finalClassMasterId,
        division_master_id: finalDivisionMasterId,
        name,
        division: section || null,
      });
      const savedClass = await queryRunner.manager.save(SchoolClass, newSchoolClass);

      if (dbTeacherId) {
        const newClassTeacher = queryRunner.manager.create(SchoolClassTeacher, {
          school_id: schoolId,
          school_academic_year_id: finalSayId,
          class_id: savedClass.id,
          division_master_id: finalDivisionMasterId,
          teacher_id: dbTeacherId,
          is_primary: true,
        });
        await queryRunner.manager.save(SchoolClassTeacher, newClassTeacher);
      }

      if (subjects && Array.isArray(subjects)) {
        for (const sub of subjects) {
          const cleanSub = String(sub).trim();
          if (!cleanSub) continue;

          let sm = await queryRunner.manager.findOne(SubjectMaster, {
            where: { name: cleanSub },
          });
          if (!sm) {
            sm = queryRunner.manager.create(SubjectMaster, {
              name: cleanSub,
              code: cleanSub.substring(0, 10).toUpperCase(),
            });
            sm = await queryRunner.manager.save(SubjectMaster, sm);
          }

          const newClassSub = queryRunner.manager.create(SchoolClassSubject, {
            school_id: schoolId,
            school_academic_year_id: finalSayId,
            class_id: savedClass.id,
            subject_master_id: sm.id,
          });
          await queryRunner.manager.save(SchoolClassSubject, newClassSub);

          if (dbTeacherId) {
            const newSubTeacher = queryRunner.manager.create(SchoolSubjectTeacher, {
              school_id: schoolId,
              school_academic_year_id: finalSayId,
              subject_master_id: sm.id,
              teacher_id: dbTeacherId,
              class_id: savedClass.id,
            });
            await queryRunner.manager.save(SchoolSubjectTeacher, newSubTeacher);
          }
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
    const { name, section, teacherId, subjects, classMasterId, divisionMasterId, schoolAcademicYearId, academicYear } = data;
    const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;

    const finalSayId = await this.ayService.getSchoolAcademicYearId(
      schoolId,
      headerVal || schoolAcademicYearId || academicYear
    );
    const finalClassMasterId = await this.resolveClassMasterId(
      name,
      classMasterId ? toIntID(String(classMasterId)) : null
    );
    const finalDivisionMasterId = await this.resolveDivisionMasterId(
      section,
      divisionMasterId ? toIntID(String(divisionMasterId)) : null
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(SchoolClass, classId, {
        name,
        division: section || null,
        school_academic_year_id: finalSayId,
        class_master_id: finalClassMasterId,
        division_master_id: finalDivisionMasterId,
      });

      await queryRunner.manager.delete(SchoolClassTeacher, { class_id: classId, is_primary: true });
      if (dbTeacherId) {
        const ct = queryRunner.manager.create(SchoolClassTeacher, {
          school_id: schoolId,
          school_academic_year_id: finalSayId,
          class_id: classId,
          division_master_id: finalDivisionMasterId,
          teacher_id: dbTeacherId,
          is_primary: true,
        });
        await queryRunner.manager.save(SchoolClassTeacher, ct);
      }

      if (subjects && Array.isArray(subjects)) {
        const cleanSubjects = subjects.map((s: any) => String(s).trim()).filter(Boolean);
        await queryRunner.manager.delete(SchoolClassSubject, { class_id: classId });
        await queryRunner.manager.delete(SchoolSubjectTeacher, { class_id: classId });

        for (const subName of cleanSubjects) {
          let sm = await queryRunner.manager.findOne(SubjectMaster, {
            where: { name: subName },
          });
          if (!sm) {
            sm = queryRunner.manager.create(SubjectMaster, {
              name: subName,
              code: subName.substring(0, 10).toUpperCase(),
            });
            sm = await queryRunner.manager.save(SubjectMaster, sm);
          }

          const scs = queryRunner.manager.create(SchoolClassSubject, {
            school_id: schoolId,
            school_academic_year_id: finalSayId,
            class_id: classId,
            subject_master_id: sm.id,
          });
          await queryRunner.manager.save(SchoolClassSubject, scs);

          if (dbTeacherId) {
            const sst = queryRunner.manager.create(SchoolSubjectTeacher, {
              school_id: schoolId,
              school_academic_year_id: finalSayId,
              class_id: classId,
              subject_master_id: sm.id,
              teacher_id: dbTeacherId,
            });
            await queryRunner.manager.save(SchoolSubjectTeacher, sst);
          }
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

  async deleteClass(classId: number) {
    await this.schoolClassRepo.delete(classId);
  }

  async getClassMasters() {
    return this.classMasterRepo.find({ order: { grade_level: "ASC" } });
  }

  
  async getDivisionMasters() {
    return this.divisionMasterRepo.find({ order: { id: "ASC" } });
  }

  async getSchoolClassTeachers(
    schoolId: number,
    schoolAcademicYearId?: number | null,
    classId?: number | null
  ) {
    const qb = this.schoolClassTeacherRepo
      .createQueryBuilder("sct")
      .leftJoinAndSelect("sct.teacher", "teacher")
      .leftJoinAndSelect("sct.class", "class")
      .leftJoinAndSelect("sct.division_master", "division")
      .where("sct.school_id = :schoolId", { schoolId });

    if (schoolAcademicYearId) {
      qb.andWhere("sct.school_academic_year_id = :schoolAcademicYearId", {
        schoolAcademicYearId,
      });
    }
    if (classId) qb.andWhere("sct.class_id = :classId", { classId });

    qb.orderBy("teacher.name", "ASC").addOrderBy("class.name", "ASC");

    const assignments = await qb.getMany();
    return assignments.map((assignment) => ({
      id: String(assignment.id),
      schoolId: String(assignment.school_id),
      schoolAcademicYearId: assignment.school_academic_year_id
        ? String(assignment.school_academic_year_id)
        : null,
      classId: String(assignment.class_id),
      className: assignment.class?.name || null,
      teacherId: String(assignment.teacher_id),
      teacherName: assignment.teacher?.name || null,
      divisionId: assignment.division_master_id
        ? String(assignment.division_master_id)
        : null,
      divisionName: assignment.division_master?.name || null,
      isPrimary: assignment.is_primary,
    }));
  }

  

  async createClassesBatch(
    schoolId: number,
    items: { name: string; section?: string | null; teacherId?: number | null; classMasterId?: number | null; divisionMasterId?: number | null; schoolAcademicYearId?: number | null; academicYear?: string | null }[],
    headerVal?: number | null
  ) {
    const createdClasses: any[] = [];

    for (const item of items) {
      const { name, section, teacherId, classMasterId, divisionMasterId, schoolAcademicYearId, academicYear } = item;
      const dbTeacherId = teacherId ? toIntID(String(teacherId)) : null;
      const itemSayId = await this.ayService.getSchoolAcademicYearId(schoolId, schoolAcademicYearId || academicYear || headerVal);
      const finalClassMasterId = await this.resolveClassMasterId(
        name,
        classMasterId ? toIntID(String(classMasterId)) : null
      );
      const finalDivisionMasterId = await this.resolveDivisionMasterId(
        section,
        divisionMasterId ? toIntID(String(divisionMasterId)) : null
      );

      let existing = await this.schoolClassRepo.findOne({
        where: {
          school_id: schoolId,
          name,
          division: section,
          school_academic_year_id: itemSayId || undefined,
        },
      });

      if (existing) {
        createdClasses.push({
          id: String(existing.id),
          name: existing.name,
          section: existing.division || "",
          division: existing.division || "",
          schoolAcademicYearId: existing.school_academic_year_id ? String(existing.school_academic_year_id) : null,
          classMasterId: existing.class_master_id ? String(existing.class_master_id) : null,
        });
        continue;
      }

      const newCls = this.schoolClassRepo.create({
        school_id: schoolId,
        school_academic_year_id: itemSayId,
        class_master_id: finalClassMasterId,
        name,
        division: section || null,
        division_master_id: finalDivisionMasterId,
      });

      const saved = await this.schoolClassRepo.save(newCls);

      if (dbTeacherId) {
        await this.dataSource.query(
          `INSERT INTO school_class_teachers (school_id, school_academic_year_id, class_id, teacher_id, is_primary)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT DO NOTHING`,
          [schoolId, itemSayId, saved.id, dbTeacherId]
        );
      }

      createdClasses.push({
        id: String(saved.id),
        name: saved.name,
        section: saved.division || "",
        division: saved.division || "",
        schoolAcademicYearId: saved.school_academic_year_id ? String(saved.school_academic_year_id) : null,
        classMasterId: saved.class_master_id ? String(saved.class_master_id) : null,
      });
    }

    return createdClasses;
  }
}

