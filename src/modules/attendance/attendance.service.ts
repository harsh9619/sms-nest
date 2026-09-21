import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Attendance } from "../../entities/attendance.entity.js";
import { toIntID } from "../../db/index.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    private ayService: AcademicYearService,
  ) { }

  async getAttendance(
    schoolId: number,
    academicYearHeader: string,
    date?: string,
    startDate?: string,
    endDate?: string,
    classId?: number,
    divisionId?: number,
    status?: string,
    search?: string
  ) {
    let sayId: number | null = null;
    sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
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
    // if (academicYear) {
    //   qb.andWhere("ay.label = :academicYear", { academicYear });
    // }
    if (startDate && endDate) {
      qb.andWhere("att.date >= :startDate AND att.date <= :endDate", { startDate, endDate });
    } else if (date) {
      qb.andWhere("att.date = :date", { date });
    }
    if (classId) {
      qb.andWhere("(c.class_master_id = :classId OR att.class_id = :classId)", { classId });
    }
    if (divisionId) {
      qb.andWhere("c.division_master_id = :divisionId", { divisionId });
    }
    if (status && status !== "all") {
      qb.andWhere("att.status = :status", { status });
    }
    if (search && search.trim()) {
      qb.andWhere(
        "(LOWER(u.name) LIKE :search OR LOWER(st.roll_no) LIKE :search)",
        { search: `%${search.trim().toLowerCase()}%` }
      );
    }
    qb.andWhere("st.school_academic_year_id = :sayId", { sayId: sayId });

    qb.orderBy("att.date", "DESC");

    const records = await qb.getMany();
    return records.map((att) => ({
      id: String(att.id),
      studentId: String(att.student_id),
      studentName: att.student?.user ? att.student.user.name : "Student",
      rollNumber: att.student ? att.student.roll_no : "",
      class: att.class ? `${att.class.name}${att.class.division ? `-${att.class.division}` : ""}` : "",
      section: att.class ? att.class.division || "" : "",
      classId: att.class_id ? String(att.class_id) : undefined,
      date: att.date,
      status: att.status,
      remarks: att.remarks,
      markedBy: att.marked_by ? String(att.marked_by) : "Teacher",
      schoolId: String(att.school_id),
    }));
  }

  async getStudentAttendance(
    schoolId?: number,
    studentId?: number,
    month?: string,
    year?: string
  ) {
    const qb = this.attendanceRepo
      .createQueryBuilder("att")
      .innerJoinAndSelect("att.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("att.class", "c")
      .where("att.student_id = :studentId", { studentId });

    if (schoolId) {
      qb.andWhere("att.school_id = :schoolId", { schoolId });
    }

    if (year && month) {
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const endDate = `${year}-${month.padStart(2, "0")}-31`;
      qb.andWhere("att.date >= :startDate AND att.date <= :endDate", { startDate, endDate });
    }

    qb.orderBy("att.date", "DESC");

    const records = await qb.getMany();
    return records.map((att) => ({
      id: String(att.id),
      studentId: String(att.student_id),
      studentName: att.student?.user ? att.student.user.name : "Student",
      rollNumber: att.student ? att.student.roll_no : "",
      class: att.class ? `${att.class.name}${att.class.division ? `-${att.class.division}` : ""}` : "",
      section: att.class ? att.class.division || "" : "",
      date: att.date,
      status: att.status,
      remarks: att.remarks,
      schoolId: String(att.school_id),
    }));
  }

  async saveAttendance(
    schoolId: number,
    records: Array<{
      studentId: string;
      classId?: string;
      date: string;
      status: string;
      remarks?: string;
      markedBy?: string;
    }>
  ) {
    const savedList: any[] = [];

    for (const rec of records) {
      const sId = toIntID(rec.studentId);
      const cId = rec.classId ? toIntID(rec.classId) : null;

      // Check existing record for student on date
      let existing = await this.attendanceRepo.findOne({
        where: {
          school_id: schoolId,
          student_id: sId,
          date: rec.date,
        },
      });

      if (existing) {
        existing.status = rec.status;
        if (rec.remarks) existing.remarks = rec.remarks;
        if (cId) existing.class_id = cId;
        const updated = await this.attendanceRepo.save(existing);
        savedList.push(updated);
      } else {
        const newEntity = this.attendanceRepo.create({
          school_id: schoolId,
          student_id: sId,
          class_id: cId || undefined,
          date: rec.date,
          status: rec.status,
          remarks: rec.remarks || null,
        });
        const saved = await this.attendanceRepo.save(newEntity);
        savedList.push(saved);
      }
    }

    return savedList.map((att) => ({
      id: String(att.id),
      studentId: String(att.student_id),
      classId: att.class_id ? String(att.class_id) : undefined,
      date: att.date,
      status: att.status,
      remarks: att.remarks,
      schoolId: String(att.school_id),
    }));
  }

  async updateAttendance(
    schoolId: number,
    id: number,
    data: { status?: string; remarks?: string }
  ) {
    const att = await this.attendanceRepo.findOne({
      where: { id, school_id: schoolId },
    });

    if (!att) {
      throw new NotFoundException(`Attendance record with ID ${id} not found.`);
    }

    if (data.status) att.status = data.status;
    if (data.remarks !== undefined) att.remarks = data.remarks;

    const updated = await this.attendanceRepo.save(att);
    return {
      id: String(updated.id),
      studentId: String(updated.student_id),
      date: updated.date,
      status: updated.status,
      remarks: updated.remarks,
      schoolId: String(updated.school_id),
    };
  }
}
