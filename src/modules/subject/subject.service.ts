import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, DataSource } from "typeorm";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { SchoolClassSubject } from "../../entities/class-subject.entity.js";
import { SchoolSubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { User } from "../../entities/user.entity.js";

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
    private dataSource: DataSource
  ) {}

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

  async updateSubjectTeacher(schoolClassSubjectId: number, teacherId: number | null) {
    const scs = await this.schoolClassSubjectRepo.findOne({ where: { id: schoolClassSubjectId } });
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
          school_academic_year_id: scs.school_academic_year_id,
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

  async syncClassSubjects(schoolId: number, classId: number, masterSubjectIds: number[]) {
    await this.schoolClassSubjectRepo.delete({ school_id: schoolId, class_id: classId });

    for (const masterId of masterSubjectIds) {
      const newScs = this.schoolClassSubjectRepo.create({
        school_id: schoolId,
        class_id: classId,
        subject_master_id: masterId,
      });
      await this.schoolClassSubjectRepo.save(newScs);
    }

    return this.getSubjects(schoolId, classId);
  }
}

