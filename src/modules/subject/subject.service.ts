import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, DataSource } from "typeorm";
import { Subject } from "../../entities/subject.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(SubjectMaster)
    private subjectMasterRepo: Repository<SubjectMaster>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource
  ) {}

  async getSubjects(schoolId: number | null, classId: number | null) {
    const qb = this.subjectRepo
      .createQueryBuilder("sub")
      .leftJoinAndSelect("sub.teacher", "t")
      .leftJoinAndSelect("sub.class", "c");

    if (schoolId) {
      qb.andWhere("sub.school_id = :schoolId", { schoolId });
    }
    if (classId) {
      qb.andWhere("sub.class_id = :classId", { classId });
    }

    qb.orderBy("sub.name", "ASC");

    const list = await qb.getMany();
    return list.map((s) => ({
      id: String(s.id),
      name: s.name,
      code: s.code,
      classId: s.class_id ? String(s.class_id) : null,
      teacherId: s.teacher_id ? String(s.teacher_id) : null,
      teacherName: s.teacher ? s.teacher.name : null,
      schoolId: String(s.school_id),
      subjectMasterId: s.subject_master_id ? String(s.subject_master_id) : null,
    }));
  }

  async getSubjectMasters() {
    return this.subjectMasterRepo.find({ order: { name: "ASC" } });
  }

  async getSubjectsWithTeachers(schoolId: number | null, classId: number | null) {
    return this.getSubjects(schoolId, classId);
  }

  async updateSubjectTeacher(subjectId: number, teacherId: number | null) {
    const sub = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!sub) return null;

    sub.teacher_id = teacherId;
    await this.subjectRepo.save(sub);

    if (teacherId && sub.class_id) {
      await this.dataSource.query(
        `INSERT INTO subject_teachers (subject_id, teacher_id, class_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [subjectId, teacherId, sub.class_id]
      );
    }

    return {
      id: String(sub.id),
      name: sub.name,
      code: sub.code,
      classId: sub.class_id ? String(sub.class_id) : null,
      teacherId: sub.teacher_id ? String(sub.teacher_id) : null,
      schoolId: String(sub.school_id),
      subjectMasterId: sub.subject_master_id ? String(sub.subject_master_id) : null,
    };
  }

  async syncClassSubjects(schoolId: number, classId: number, masterSubjectIds: number[]) {
    const selectedMasters = await this.subjectMasterRepo.find({
      where: { id: In(masterSubjectIds) },
    });

    const existingSubjects = await this.subjectRepo.find({
      where: { school_id: schoolId, class_id: classId },
    });

    const existingMasterIds = new Set(
      existingSubjects.map((s) => s.subject_master_id).filter(Boolean)
    );
    const newMasterIds = new Set(masterSubjectIds);

    for (const existing of existingSubjects) {
      if (existing.subject_master_id && !newMasterIds.has(existing.subject_master_id)) {
        await this.dataSource.query(
          "DELETE FROM class_subjects WHERE class_id = $1 AND subject_id = $2",
          [classId, existing.id]
        );
        await this.subjectRepo.delete(existing.id);
      }
    }

    for (const master of selectedMasters) {
      if (!existingMasterIds.has(master.id)) {
        const newSub = this.subjectRepo.create({
          school_id: schoolId,
          class_id: classId,
          subject_master_id: master.id,
          name: master.name,
          code: master.code,
        });
        const saved = await this.subjectRepo.save(newSub);
        await this.dataSource.query(
          "INSERT INTO class_subjects (class_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [classId, saved.id]
        );
      }
    }

    return this.getSubjects(schoolId, classId);
  }
}
