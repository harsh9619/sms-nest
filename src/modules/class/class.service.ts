import { Injectable, NotFoundException } from "@nestjs/common";
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
            division_master_id: finalDivisionMasterId,
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
            division_master_id: finalDivisionMasterId,
            subject_master_id: sm.id,
          });
          await queryRunner.manager.save(SchoolClassSubject, scs);

          if (dbTeacherId) {
            const sst = queryRunner.manager.create(SchoolSubjectTeacher, {
              school_id: schoolId,
              school_academic_year_id: finalSayId,
              class_id: classId,
              division_master_id: finalDivisionMasterId,
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

  async getclassSubjectTeachersById(classId: number) {
    return this.schoolClassTeacherRepo.find({ where: { class_id: classId } });
  }

  async updateSchoolClassTeacher(
    classId: number,
    teacherId: number | null,
    schoolId: number,
    academicYearHeader?: string | number | null
  ) {
    const cls = await this.schoolClassRepo.findOne({ where: { id: classId } });
    if (!cls) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    let sayId: number | null = null;
    const targetSchoolId = schoolId || cls.school_id;
    if (targetSchoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(
        targetSchoolId,
        academicYearHeader || cls.school_academic_year_id
      );
    }

    if (teacherId) {
      let sct = await this.schoolClassTeacherRepo.findOne({
        where: { class_id: classId, is_primary: true },
      });

      if (!sct) {
        sct = await this.schoolClassTeacherRepo.findOne({
          where: { class_id: classId },
        });
      }

      if (sct) {
        sct.teacher_id = teacherId;
        if (sayId) sct.school_academic_year_id = sayId;
        if (cls.division_master_id) sct.division_master_id = cls.division_master_id;
        await this.schoolClassTeacherRepo.save(sct);
      } else {
        sct = this.schoolClassTeacherRepo.create({
          school_id: targetSchoolId,
          school_academic_year_id: sayId || cls.school_academic_year_id,
          class_id: classId,
          division_master_id: cls.division_master_id || null,
          teacher_id: teacherId,
          is_primary: true,
        });
        await this.schoolClassTeacherRepo.save(sct);
      }
    } else {
      await this.schoolClassTeacherRepo.delete({ class_id: classId });
    }

    return this.getSchoolClassTeachers(targetSchoolId, sayId);
  }

  async getSchoolClassTeachers(
    schoolId: number,
    schoolAcademicYearId?: number | null,
    classId?: number | null
  ) {
    const parameters: any[] = [schoolId];
    const filters = ["sc.school_id = $1"];

    if (classId) {
      const targetClass = await this.dataSource.getRepository(SchoolClass).findOne({ where: { id: classId } });
      if (targetClass) {
        if (targetClass.class_master_id) {
          parameters.push(targetClass.class_master_id);
          filters.push(`sc.class_master_id = $${parameters.length}`);
        } else {
          parameters.push(targetClass.name);
          filters.push(`LOWER(sc.name) = LOWER($${parameters.length})`);
        }
      } else {
        parameters.push(classId);
        filters.push(`sc.id = $${parameters.length}`);
      }
    }

    let sayId: number | null = null;
    if (schoolAcademicYearId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, schoolAcademicYearId);
    }

    if (sayId) {
      parameters.push(sayId);
      const paramIdx = parameters.length;
      filters.push(
        `(sc.school_academic_year_id = $${paramIdx}
          OR sc.school_academic_year_id IS NULL)`
      );
    }

    const rows = await this.schoolClassRepo.query(
      `SELECT
         sc.school_id,
         COALESCE(sct.school_academic_year_id, sc.school_academic_year_id) AS school_academic_year_id,
         sc.id AS class_id,
         sc.name AS class_name,
         sc.division AS class_division,
         sc.division_master_id,
         dm.name AS division_name,
         sct.id AS assignment_id,
         sct.teacher_id,
         sct.is_primary,
         teacher.name AS teacher_name
       FROM school_classes sc
       LEFT JOIN division_masters dm ON dm.id = sc.division_master_id
       LEFT JOIN school_class_teachers sct
         ON sct.school_id = sc.school_id
        AND sct.class_id = sc.id
       LEFT JOIN users teacher ON teacher.id = sct.teacher_id
       WHERE ${filters.join(" AND ")}
       ORDER BY sc.name ASC, dm.name ASC`,
      parameters
    );

    return rows.map((row: any) => ({
      id: row.assignment_id ? String(row.assignment_id) : String(row.class_id),
      classTeacherId: row.assignment_id ? String(row.assignment_id) : null,
      schoolId: String(row.school_id),
      schoolAcademicYearId: row.school_academic_year_id
        ? String(row.school_academic_year_id)
        : null,
      classId: String(row.class_id),
      className: row.class_name,
      divisionId: row.division_master_id ? String(row.division_master_id) : null,
      divisionName: row.division_name || row.class_division || null,
      classDivision: row.class_division || row.division_name || "",
      classSection: row.class_division || row.division_name || "",
      teacherId: row.teacher_id ? String(row.teacher_id) : null,
      teacherName: row.teacher_name || null,
      isPrimary: row.is_primary ?? true,
    }));
  }

  async createClassesBatch(
    schoolId: number,
    items: { name: string; section?: string | null; teacherId?: number | null; classMasterId?: number | null; divisionMasterId?: number | null; schoolAcademicYearId?: number | null; academicYear?: string | null; subjects?: (string | number)[] }[],
    headerVal?: number | null
  ) {
    const createdClasses: any[] = [];

    for (const item of items) {
      const { name, section, teacherId, classMasterId, divisionMasterId, schoolAcademicYearId, academicYear, subjects } = item;
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

      let targetClass = existing;

      if (!targetClass) {
        const newCls = this.schoolClassRepo.create({
          school_id: schoolId,
          school_academic_year_id: itemSayId,
          class_master_id: finalClassMasterId,
          name,
          division: section || null,
          division_master_id: finalDivisionMasterId,
        });

        targetClass = await this.schoolClassRepo.save(newCls);
      }

      if (dbTeacherId && targetClass) {
        await this.dataSource.query(
          `INSERT INTO school_class_teachers (school_id, school_academic_year_id, class_id, teacher_id, is_primary)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT DO NOTHING`,
          [schoolId, itemSayId, targetClass.id, dbTeacherId]
        );
      }

      if (subjects && Array.isArray(subjects) && targetClass) {
        for (const sub of subjects) {
          const cleanSub = String(sub).trim();
          if (!cleanSub) continue;

          let sm = await this.dataSource.getRepository(SubjectMaster).findOne({
            where: { name: cleanSub },
          });
          if (!sm) {
            sm = this.dataSource.getRepository(SubjectMaster).create({
              name: cleanSub,
              code: cleanSub.substring(0, 10).toUpperCase(),
            });
            sm = await this.dataSource.getRepository(SubjectMaster).save(sm);
          }

          const existingSub = await this.dataSource.getRepository(SchoolClassSubject).findOne({
            where: { school_id: schoolId, class_id: targetClass.id, subject_master_id: sm.id },
          });

          if (!existingSub) {
            const newClassSub = this.dataSource.getRepository(SchoolClassSubject).create({
              school_id: schoolId,
              school_academic_year_id: itemSayId,
              class_id: targetClass.id,
              subject_master_id: sm.id,
              division_master_id: finalDivisionMasterId,
            });
            await this.dataSource.getRepository(SchoolClassSubject).save(newClassSub);
          }
        }
      }

      createdClasses.push({
        id: String(targetClass.id),
        name: targetClass.name,
        section: targetClass.division || "",
        division: targetClass.division || "",
        schoolAcademicYearId: itemSayId ? String(itemSayId) : null,
        classMasterId: targetClass.class_master_id ? String(targetClass.class_master_id) : null,
        divisionMasterId: targetClass.division_master_id ? String(targetClass.division_master_id) : null,
      });
    }

    return createdClasses;
  }
}

