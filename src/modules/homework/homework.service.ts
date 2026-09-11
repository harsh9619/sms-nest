import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Homework } from "../../entities/homework.entity.js";

@Injectable()
export class HomeworkService {
  constructor(
    @InjectRepository(Homework)
    private homeworkRepo: Repository<Homework>
  ) {}

  async getHomework(schoolId: number | null, classId: number | null, teacherId: number | null) {
    const qb = this.homeworkRepo
      .createQueryBuilder("h")
      .innerJoinAndSelect("h.class", "c")
      .innerJoinAndSelect("h.subject", "sub")
      .leftJoinAndSelect("h.teacher", "t");

    if (schoolId) {
      qb.andWhere("h.school_id = :schoolId", { schoolId });
    }
    if (classId) {
      qb.andWhere("h.class_id = :classId", { classId });
    }
    if (teacherId) {
      qb.andWhere("h.teacher_id = :teacherId", { teacherId });
    }

    qb.orderBy("h.created_at", "DESC");

    const list = await qb.getMany();
    return list.map((h) => ({
      id: String(h.id),
      classId: String(h.class_id),
      className: h.class ? `${h.class.name}-${h.class.division || ""}` : "",
      subjectId: String(h.subject_id),
      subjectName: h.subject ? h.subject.name : "",
      teacherId: h.teacher_id ? String(h.teacher_id) : null,
      teacherName: h.teacher ? h.teacher.name : "Unassigned",
      title: h.title,
      description: h.description,
      dueDate: h.due_date,
      assignedDate: h.created_at ? new Date(h.created_at).toISOString().split("T")[0] : null,
      schoolId: String(h.school_id),
    }));
  }

  async createHomework(schoolId: number, data: any) {
    const { classId, subjectId, teacherId, title, description, dueDate } = data;

    const newHw = this.homeworkRepo.create({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      title,
      description,
      due_date: dueDate,
    });

    const saved = await this.homeworkRepo.save(newHw);
    const list = await this.getHomework(schoolId, null, null);
    return list.find((h) => Number(h.id) === saved.id) || null;
  }

  async updateHomework(homeworkId: number, data: any) {
    const { classId, subjectId, title, description, dueDate } = data;

    await this.homeworkRepo.update(homeworkId, {
      class_id: classId,
      subject_id: subjectId,
      title,
      description,
      due_date: dueDate,
    });

    const hw = await this.homeworkRepo.findOne({ where: { id: homeworkId } });
    if (!hw) return null;

    const list = await this.getHomework(hw.school_id, null, null);
    return list.find((h) => Number(h.id) === homeworkId) || null;
  }

  async deleteHomework(homeworkId: number) {
    const hw = await this.homeworkRepo.findOne({ where: { id: homeworkId } });
    if (!hw) return null;

    const list = await this.getHomework(hw.school_id, null, null);
    const resultObj = list.find((h) => Number(h.id) === homeworkId) || null;

    await this.homeworkRepo.delete(homeworkId);
    return resultObj;
  }
}
