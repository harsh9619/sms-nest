import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Attendance } from "../../entities/attendance.entity.js";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>
  ) {}

  async getAttendance(schoolId?: number, academicYear?: string) {
    const qb = this.attendanceRepo
      .createQueryBuilder("att")
      .innerJoinAndSelect("att.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("att.class", "c")
      .leftJoinAndSelect("att.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("att.school_id = :schoolId", { schoolId });
    }
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }

    qb.orderBy("att.date", "DESC");

    const records = await qb.getMany();
    return records.map((att) => ({
      id: String(att.id),
      studentId: String(att.student_id),
      studentName: att.student?.user ? att.student.user.name : "",
      rollNumber: att.student ? att.student.roll_no : "",
      class: att.class ? `${att.class.name}-${att.class.section}` : "",
      section: att.class ? att.class.section : "",
      date: att.date,
      status: att.status,
      remarks: att.remarks,
      schoolId: String(att.school_id),
    }));
  }
}
