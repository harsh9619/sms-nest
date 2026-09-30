import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, DataSource } from "typeorm";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { SchoolClassSubject } from "../../entities/class-subject.entity.js";
import { SchoolSubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";
import { SchoolClass } from "../../entities/school-class.entity.js";

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(SubjectMaster)
    private subjectMasterRepo: Repository<SubjectMaster>,
    @InjectRepository(SchoolClassSubject)
    private schoolClassSubjectRepo: Repository<SchoolClassSubject>,
    @InjectRepository(SchoolSubjectTeacher)
    private schoolSubjectTeacherRepo: Repository<SchoolSubjectTeacher>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private ayService: AcademicYearService,
    private dataSource: DataSource,
  ) { }

  async getSubjects(schoolId: number | null, classId: number | null) {
    const qb = this.schoolClassSubjectRepo
      .createQueryBuilder("scs")
      .leftJoinAndSelect("scs.subject_master", "sm")
      .leftJoinAndSelect("scs.class", "c");

    if (schoolId) {
      qb.andWhere("scs.school_id = :schoolId", { schoolId });
    }
    if (classId) {
      qb.andWhere("scs.class_id = :classId", { classId });
    }

    qb.orderBy("sm.name", "ASC");

    const list = await qb.getMany();
    return Promise.all(
      list.map(async (scs) => {
        const teacherRes = await this.schoolSubjectTeacherRepo.findOne({
          where: { class_id: scs.class_id, subject_master_id: scs.subject_master_id },
          relations: { teacher: true },
        });

        return {
          id: String(scs.id),
          name: scs.subject_master ? scs.subject_master.name : "",
          code: scs.subject_master ? scs.subject_master.code : "",
          classId: scs.class_id ? String(scs.class_id) : null,
          teacherId: teacherRes?.teacher_id ? String(teacherRes.teacher_id) : null,
          teacherName: teacherRes?.teacher ? teacherRes.teacher.name : null,
          schoolId: String(scs.school_id),
          subjectMasterId: String(scs.subject_master_id),
        };
      })
    );
  }

  async getSubjectMasters() {
    return this.subjectMasterRepo.find({ order: { name: "ASC" } });
  }

  async getSubjectsWithTeachers(schoolId: number | null, classId: number | null) {
    return this.getSubjects(schoolId, classId);
  }

  async updateSubjectTeacher(schoolClassSubjectId: number, teacherId: number | null, academicYearHeader: string | number, schoolId: number) {
    const scs = await this.schoolClassSubjectRepo.findOne({ where: { id: schoolClassSubjectId } });
    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }
    if (!scs) return null;

    if (teacherId) {
      let sst = await this.schoolSubjectTeacherRepo.findOne({
        where: { class_id: scs.class_id, subject_master_id: scs.subject_master_id },
      });
      if (sst) {
        sst.teacher_id = teacherId;
        await this.schoolSubjectTeacherRepo.save(sst);
      } else {
        sst = this.schoolSubjectTeacherRepo.create({
          school_id: scs.school_id,
          school_academic_year_id: sayId,
          class_id: scs.class_id,
          subject_master_id: scs.subject_master_id,
          teacher_id: teacherId,
        });
        await this.schoolSubjectTeacherRepo.save(sst);
      }
    } else {
      await this.schoolSubjectTeacherRepo.delete({
        class_id: scs.class_id,
        subject_master_id: scs.subject_master_id,
      });
    }

    return this.getSubjects(scs.school_id, scs.class_id);
  }

  async getSchoolSubjectTeachers(
    schoolId: number,
    classId?: number | null,
    schoolAcademicYearId?: number | null
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

    const rows = await this.schoolClassSubjectRepo.query(
      `SELECT
         scs.id AS class_subject_id,
         sc.school_id,
         COALESCE(scs.school_academic_year_id, sc.school_academic_year_id) AS school_academic_year_id,
         sc.id AS class_id,
         sc.name AS class_name,
         sc.division AS class_division,
         sc.division_master_id,
         dm.name AS division_name,
         sm.id AS subject_master_id,
         sm.name AS subject_name,
         sm.code AS subject_code,
         sst.id AS assignment_id,
         sst.teacher_id,
         teacher.name AS teacher_name
       FROM school_classes sc
       LEFT JOIN school_class_subjects scs ON scs.class_id = sc.id
       LEFT JOIN subject_masters sm ON sm.id = scs.subject_master_id
       LEFT JOIN division_masters dm ON dm.id = sc.division_master_id
       LEFT JOIN school_subject_teachers sst
         ON sst.school_id = sc.school_id
        AND sst.class_id = sc.id
        AND sst.subject_master_id = sm.id
       LEFT JOIN users teacher ON teacher.id = sst.teacher_id
       WHERE ${filters.join(" AND ")}
       ORDER BY sc.class_master_id ASC, dm.name ASC, sm.name ASC`,
      parameters
    );

    return rows.map((row: any) => ({
      id: row.assignment_id ? String(row.assignment_id) : (row.class_subject_id ? String(row.class_subject_id) : null),
      classSubjectId: row.class_subject_id ? String(row.class_subject_id) : null,
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
      subjectId: row.subject_master_id ? String(row.subject_master_id) : null,
      subjectName: row.subject_name || "",
      name: row.subject_name || "",
      code: row.subject_code || null,
      teacherId: row.teacher_id ? String(row.teacher_id) : null,
      teacherName: row.teacher_name || null,
    }));
  }

  async addClassSubjects(schoolId: number, classId: number, masterSubjectIds: number[]) {
    const cls = await this.dataSource.getRepository(SchoolClass).findOne({ where: { id: classId } });
    if (!cls) return this.getSubjects(schoolId, classId);

    const relatedClasses = await this.dataSource.getRepository(SchoolClass).find({
      where: cls.class_master_id
        ? { school_id: schoolId, class_master_id: cls.class_master_id }
        : { school_id: schoolId, name: cls.name },
    });

    const classIds = relatedClasses.map((c) => c.id);

    await this.schoolClassSubjectRepo.delete({ school_id: schoolId, class_id: In(classIds) });

    for (const relatedClass of relatedClasses) {
      for (const masterId of masterSubjectIds) {
        const newScs = this.schoolClassSubjectRepo.create({
          school_id: schoolId,
          school_academic_year_id: relatedClass.school_academic_year_id || cls.school_academic_year_id,
          class_id: relatedClass.id,
          division_master_id: relatedClass.division_master_id,
          subject_master_id: masterId,
        });
        await this.schoolClassSubjectRepo.save(newScs);
      }
    }

    return this.getSubjects(schoolId, classId);
  }
}

