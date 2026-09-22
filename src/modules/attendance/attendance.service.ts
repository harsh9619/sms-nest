import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
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
      .leftJoinAndSelect("st.parent_user", "pu")
      .leftJoinAndSelect("att.class", "c")
      .leftJoinAndSelect("att.marker", "marker")
      .leftJoinAndSelect("att.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("att.school_id = :schoolId", { schoolId });
    }
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
        "(LOWER(u.name) LIKE :search OR LOWER(st.roll_no) LIKE :search OR LOWER(st.registration_no) LIKE :search OR LOWER(st.scholar_no) LIKE :search)",
        { search: `%${search.trim().toLowerCase()}%` }
      );
    }
    qb.andWhere("st.school_academic_year_id = :sayId", { sayId: sayId });

    qb.orderBy("att.date", "DESC");

    const records = await qb.getMany();
    return records.map((att) => {
      const studentObj = att.student ? {
        id: String(att.student.id),
        schoolId: String(att.student.school_id),
        schoolAcademicYearId: att.student.school_academic_year_id ? String(att.student.school_academic_year_id) : null,
        userId: att.student.user_id ? String(att.student.user_id) : null,
        name: att.student.user ? att.student.user.name : "",
        email: att.student.user ? att.student.user.email : "",
        phone: att.student.user?.phone || att.student.whatsapp_no || "",
        avatarUrl: att.student.user?.avatar_url || null,
        rollNo: att.student.roll_no || "",
        registrationNo: att.student.registration_no || "",
        scholarNo: att.student.scholar_no || "",
        dob: att.student.dob || "",
        gender: att.student.gender || "",
        bloodGroup: att.student.blood_group || "",
        casteCategory: att.student.caste_category || "",
        fatherName: att.student.father_name || "",
        fatherOccupation: att.student.father_occupation || "",
        fatherQualification: att.student.father_qualification || "",
        motherName: att.student.mother_name || "",
        motherOccupation: att.student.mother_occupation || "",
        motherQualification: att.student.mother_qualification || "",
        guardianName: att.student.guardian_name || "",
        guardianPhone: att.student.guardian_phone || "",
        whatsappNo: att.student.whatsapp_no || "",
        address: att.student.address || "",
        admissionDate: att.student.admission_date || "",
        medium: att.student.medium || "",
        academicYear: att.student.academic_year || "",
        parentUser: att.student.parent_user ? {
          id: String(att.student.parent_user.id),
          name: att.student.parent_user.name,
          email: att.student.parent_user.email,
          phone: att.student.parent_user.phone,
        } : null,
      } : null;

      const markerObj = att.marker ? {
        id: String(att.marker.id),
        name: att.marker.name,
        email: att.marker.email,
        phone: att.marker.phone,
        role: att.marker.role,
      } : null;

      return {
        id: String(att.id),
        studentId: String(att.student_id),
        studentName: att.student?.user ? att.student.user.name : "Student",
        rollNumber: att.student ? (att.student.roll_no || "") : "",
        class: att.class ? att.class.name : "",
        section: att.class ? att.class.division || "" : "",
        classId: att.class_id ? String(att.class_id) : undefined,
        date: att.date,
        status: att.status,
        remarks: att.remarks,
        markedBy: att.marker ? att.marker.name : (att.marked_by ? String(att.marked_by) : "Teacher"),
        markedById: att.marked_by ? String(att.marked_by) : null,
        markedByName: att.marker ? att.marker.name : (att.marked_by ? `User #${att.marked_by}` : "Teacher"),
        markedByTeacher: markerObj,
        markedUser: markerObj,
        markedAt: att.created_at ? new Date(att.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : undefined,
        createdAt: att.created_at ? new Date(att.created_at).toISOString() : undefined,
        schoolId: String(att.school_id),
        studentDetail: studentObj,
      };
    });
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
      .leftJoinAndSelect("st.parent_user", "pu")
      .leftJoinAndSelect("att.class", "c")
      .leftJoinAndSelect("att.marker", "marker")
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
    return records.map((att) => {
      const studentObj = att.student ? {
        id: String(att.student.id),
        schoolId: String(att.student.school_id),
        userId: att.student.user_id ? String(att.student.user_id) : null,
        name: att.student.user ? att.student.user.name : "",
        email: att.student.user ? att.student.user.email : "",
        phone: att.student.user?.phone || att.student.whatsapp_no || "",
        avatarUrl: att.student.user?.avatar_url || null,
        rollNo: att.student.roll_no || "",
        registrationNo: att.student.registration_no || "",
        scholarNo: att.student.scholar_no || "",
        dob: att.student.dob || "",
        gender: att.student.gender || "",
        bloodGroup: att.student.blood_group || "",
        casteCategory: att.student.caste_category || "",
        fatherName: att.student.father_name || "",
        motherName: att.student.mother_name || "",
        guardianName: att.student.guardian_name || "",
        guardianPhone: att.student.guardian_phone || "",
        whatsappNo: att.student.whatsapp_no || "",
        address: att.student.address || "",
        admissionDate: att.student.admission_date || "",
        parentUser: att.student.parent_user ? {
          id: String(att.student.parent_user.id),
          name: att.student.parent_user.name,
          email: att.student.parent_user.email,
          phone: att.student.parent_user.phone,
        } : null,
      } : null;

      const markerObj = att.marker ? {
        id: String(att.marker.id),
        name: att.marker.name,
        email: att.marker.email,
        phone: att.marker.phone,
        role: att.marker.role,
      } : null;

      return {
        id: String(att.id),
        studentId: String(att.student_id),
        studentName: att.student?.user ? att.student.user.name : "Student",
        rollNumber: att.student ? att.student.roll_no || "" : "",
        class: att.class ? `${att.class.name}` : "",
        section: att.class ? att.class.division || "" : "",
        date: att.date,
        status: att.status,
        remarks: att.remarks,
        markedBy: att.marker ? att.marker.name : (att.marked_by ? String(att.marked_by) : "Teacher"),
        markedById: att.marked_by ? String(att.marked_by) : null,
        markedByName: att.marker ? att.marker.name : (att.marked_by ? `User #${att.marked_by}` : "Teacher"),
        markedByTeacher: markerObj,
        markedUser: markerObj,
        schoolId: String(att.school_id),
        student: studentObj,
        studentDetail: studentObj,
      };
    });
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
    }>,
    loggedInUserId?: number | string
  ) {
    const savedList: any[] = [];
    const defaultMarkerId = loggedInUserId ? toIntID(loggedInUserId) : null;

    for (const rec of records) {
      const sId = toIntID(rec.studentId);
      const cId = rec.classId ? toIntID(rec.classId) : null;
      const markerId = rec.markedBy ? toIntID(rec.markedBy) : defaultMarkerId;

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
        if (markerId) existing.marked_by = markerId;
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
          marked_by: markerId || undefined,
        });
        const saved = await this.attendanceRepo.save(newEntity);
        savedList.push(saved);
      }
    }

    const savedIds = savedList.map((s) => s.id);
    if (savedIds.length === 0) return [];

    const fullRecords = await this.attendanceRepo.find({
      where: { id: In(savedIds) },
      relations: { student: { user: true }, class: true, marker: true },
    });

    return fullRecords.map((att) => {
      const markerObj = att.marker
        ? {
            id: String(att.marker.id),
            name: att.marker.name,
            email: att.marker.email,
            phone: att.marker.phone,
            role: att.marker.role,
          }
        : null;

      const studentObj = att.student
        ? {
            id: String(att.student.id),
            userId: String(att.student.user_id),
            name: att.student.user ? att.student.user.name : "Student",
            rollNo: att.student.roll_no || "",
          }
        : null;

      return {
        id: String(att.id),
        studentId: String(att.student_id),
        studentName: att.student?.user ? att.student.user.name : "Student",
        rollNumber: att.student ? (att.student.roll_no || "") : "",
        class: att.class ? att.class.name : "",
        section: att.class ? att.class.division || "" : "",
        classId: att.class_id ? String(att.class_id) : undefined,
        date: att.date,
        status: att.status,
        remarks: att.remarks,
        markedBy: att.marker ? att.marker.name : (att.marked_by ? String(att.marked_by) : "Teacher"),
        markedById: att.marked_by ? String(att.marked_by) : null,
        markedByName: att.marker ? att.marker.name : (att.marked_by ? `User #${att.marked_by}` : "Teacher"),
        markedByTeacher: markerObj,
        markedUser: markerObj,
        markedAt: att.created_at ? new Date(att.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : undefined,
        createdAt: att.created_at ? new Date(att.created_at).toISOString() : undefined,
        schoolId: String(att.school_id),
        studentDetail: studentObj,
      };
    });
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
