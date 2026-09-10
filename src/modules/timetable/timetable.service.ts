import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Timetable } from "../../entities/timetable.entity.js";

@Injectable()
export class TimetableService {
  constructor(
    @InjectRepository(Timetable)
    private ttRepo: Repository<Timetable>
  ) {}

  async getTimetables(schoolId: number | null, classId: number | null, teacherId: number | null) {
    const qb = this.ttRepo
      .createQueryBuilder("tt")
      .innerJoinAndSelect("tt.class", "c")
      .innerJoinAndSelect("tt.subject", "sub")
      .leftJoinAndSelect("sub.teacher", "t");

    if (schoolId) {
      qb.andWhere("tt.school_id = :schoolId", { schoolId });
    }
    if (classId) {
      qb.andWhere("tt.class_id = :classId", { classId });
    }
    if (teacherId) {
      qb.andWhere("sub.teacher_id = :teacherId", { teacherId });
    }

    qb.orderBy("tt.day_of_week", "ASC").addOrderBy("tt.start_time", "ASC");

    const slots = await qb.getMany();
    return slots.map((s) => ({
      id: String(s.id),
      classId: String(s.class_id),
      className: s.class ? `${s.class.name}-${s.class.section}` : "",
      subjectId: String(s.subject_id),
      subjectName: s.subject ? s.subject.name : "",
      teacherId: s.subject?.teacher_id ? String(s.subject.teacher_id) : null,
      teacherName: s.subject?.teacher ? s.subject.teacher.name : "Unassigned",
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      classroom: s.classroom,
      schoolId: String(s.school_id),
    }));
  }

  async createTimetable(schoolId: number, data: any) {
    const { classId, subjectId, dayOfWeek, startTime, endTime, classroom } = data;

    const newSlot = this.ttRepo.create({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      day_of_week: dayOfWeek.toLowerCase(),
      start_time: startTime,
      end_time: endTime,
      classroom,
    });

    const saved = await this.ttRepo.save(newSlot);
    const list = await this.getTimetables(schoolId, classId, null);
    return list.find((s) => Number(s.id) === saved.id) || null;
  }

  async updateTimetable(timetableId: number, data: any) {
    const { classId, subjectId, dayOfWeek, startTime, endTime, classroom } = data;

    await this.ttRepo.update(timetableId, {
      class_id: classId,
      subject_id: subjectId,
      day_of_week: dayOfWeek.toLowerCase(),
      start_time: startTime,
      end_time: endTime,
      classroom,
    });

    const slot = await this.ttRepo.findOne({ where: { id: timetableId } });
    if (!slot) return null;

    const list = await this.getTimetables(slot.school_id, null, null);
    return list.find((s) => Number(s.id) === timetableId) || null;
  }

  async deleteTimetable(timetableId: number) {
    const slot = await this.ttRepo.findOne({ where: { id: timetableId } });
    if (!slot) return null;

    const list = await this.getTimetables(slot.school_id, null, null);
    const resultObj = list.find((s) => Number(s.id) === timetableId) || null;

    await this.ttRepo.delete(timetableId);
    return resultObj;
  }
}
