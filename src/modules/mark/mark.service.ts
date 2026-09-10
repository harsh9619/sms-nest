import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Mark } from "../../entities/mark.entity.js";

@Injectable()
export class MarkService {
  constructor(
    @InjectRepository(Mark)
    private markRepo: Repository<Mark>
  ) {}

  async getMarks(
    schoolId: number | null,
    studentId: number | null,
    subjectId: number | null,
    classId: number | null,
    academicYear?: string | null
  ) {
    const qb = this.markRepo
      .createQueryBuilder("m")
      .innerJoinAndSelect("m.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .innerJoinAndSelect("m.subject", "sub")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("m.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("m.school_id = :schoolId", { schoolId });
    }
    if (studentId) {
      qb.andWhere("m.student_id = :studentId", { studentId });
    }
    if (subjectId) {
      qb.andWhere("m.subject_id = :subjectId", { subjectId });
    }
    if (classId) {
      qb.andWhere("st.class_id = :classId", { classId });
    }
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }

    qb.orderBy("m.exam_date", "DESC");

    const list = await qb.getMany();
    return list.map((m) => ({
      id: String(m.id),
      studentId: String(m.student_id),
      studentName: m.student?.user ? m.student.user.name : "",
      rollNumber: m.student ? m.student.roll_no : "",
      class: m.student?.class ? `${m.student.class.name}-${m.student.class.section}` : "",
      subjectId: String(m.subject_id),
      subjectName: m.subject ? m.subject.name : "",
      examType: m.exam_type,
      score: m.score !== null ? Number(m.score) : null,
      maxScore: Number(m.max_score),
      examDate: m.exam_date,
      remarks: m.remarks,
      schoolId: String(m.school_id),
    }));
  }

  async createOrUpdateMark(schoolId: number, data: any) {
    const { studentId, subjectId, examType, score, maxScore, examDate } = data;

    let mark = await this.markRepo.findOne({
      where: {
        school_id: schoolId,
        student_id: studentId,
        subject_id: subjectId,
        exam_type: examType,
        exam_date: examDate || undefined,
      },
    });

    if (mark) {
      mark.score = score;
      mark.max_score = maxScore || 100;
      await this.markRepo.save(mark);
    } else {
      mark = this.markRepo.create({
        school_id: schoolId,
        student_id: studentId,
        subject_id: subjectId,
        exam_type: examType,
        score,
        max_score: maxScore || 100,
        exam_date: examDate || new Date().toISOString().split("T")[0],
      });
      mark = await this.markRepo.save(mark);
    }

    const list = await this.getMarks(schoolId, studentId, subjectId, null, null);
    return list.find((m) => Number(m.id) === mark.id) || null;
  }

  async updateMark(markId: number, data: any) {
    const { score, maxScore, examDate } = data;

    await this.markRepo.update(markId, {
      score,
      max_score: maxScore,
      exam_date: examDate,
    });

    const m = await this.markRepo.findOne({ where: { id: markId } });
    if (!m) return null;

    const list = await this.getMarks(m.school_id, m.student_id, m.subject_id, null, null);
    return list.find((item) => Number(item.id) === markId) || null;
  }

  async deleteMark(markId: number) {
    const m = await this.markRepo.findOne({ where: { id: markId } });
    if (!m) return null;

    const list = await this.getMarks(m.school_id, m.student_id, m.subject_id, null, null);
    const resultObj = list.find((item) => Number(item.id) === markId) || null;

    await this.markRepo.delete(markId);
    return resultObj;
  }
}
