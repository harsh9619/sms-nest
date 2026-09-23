import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Attendance } from "../../entities/attendance.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClassTeacher } from "../../entities/class-teacher.entity.js";
import { User } from "../../entities/user.entity.js";
import { toIntID } from "../../db/index.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(SchoolClassTeacher)
    private schoolClassTeacherRepo: Repository<SchoolClassTeacher>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
    search?: string,
    currentUser?: any
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

  async getAttendanceStudentList(
    schoolId?: number,
    academicYearHeader?: string,
    classId?: number,
    divisionId?: number,
    search?: string,
    date?: string,
    currentUser?: any
  ) {
    let userId: number | null = null;
    let userRole: string = "";

    if (currentUser) {
      const rawUserId = currentUser.sub || currentUser.id || currentUser.userId;
      if (rawUserId) {
        userId = toIntID(String(rawUserId));
      }
      if (currentUser.role) {
        userRole = String(currentUser.role).toLowerCase();
      }
    }

    if (userId) {
      const dbUser = await this.userRepo.findOne({ where: { id: userId } });
      if (dbUser) {
        if (!userRole) {
          userRole = String(dbUser.role || "").toLowerCase();
        }
        if (!schoolId && dbUser.school_id) {
          schoolId = dbUser.school_id;
        }
      }
    }

    const isTeacher = userRole === "teacher";

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    const qb = this.studentRepo
      .createQueryBuilder("st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("st.division_master", "dm")
      .leftJoinAndSelect("st.caste_master", "cm")
      .leftJoinAndSelect("st.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay")
      .where("u.is_active = :isActive", { isActive: true })
      .andWhere("st.is_deleted = :isDeleted", { isDeleted: false });

    if (schoolId) {
      qb.andWhere("st.school_id = :schoolId", { schoolId });
    }

    if (sayId) {
      qb.andWhere("st.school_academic_year_id = :sayId", { sayId });
    }

    if (isTeacher) {
      if (!userId) {
        return [];
      }

      const ctWhere: any = { teacher_id: userId };
      if (schoolId) {
        ctWhere.school_id = schoolId;
      }
      const classTeacherRecords = await this.schoolClassTeacherRepo.find({
        where: ctWhere,
      });

      const teacherClassIds = Array.from(new Set(classTeacherRecords.map((ct) => ct.class_id).filter(Boolean)));

      if (teacherClassIds.length === 0) {
        return [];
      }

      if (classId) {
        if (teacherClassIds.includes(classId)) {
          qb.andWhere("st.class_id = :classId", { classId });
        } else {
          return [];
        }
      } else {
        qb.andWhere("st.class_id IN (:...teacherClassIds)", { teacherClassIds });
      }
    } else {
      if (classId) {
        qb.andWhere("st.class_id = :classId", { classId });
      }
    }

    if (divisionId) {
      qb.andWhere("(st.division_master_id = :divisionId OR c.division_master_id = :divisionId)", { divisionId });
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE :s OR LOWER(u.email) LIKE :s OR LOWER(st.roll_no) LIKE :s OR LOWER(st.registration_no) LIKE :s OR LOWER(st.scholar_no) LIKE :s)",
        { s }
      );
    }

    qb.orderBy("c.name", "ASC")
      .addOrderBy("dm.name", "ASC")
      .addOrderBy("st.roll_no", "ASC");

    const students = await qb.getMany();

    let attendanceMap: Record<number, Attendance> = {};
    if (date && students.length > 0) {
      const studentIds = students.map((st) => st.id);
      const attRecords = await this.attendanceRepo
        .createQueryBuilder("att")
        .where("att.student_id IN (:...studentIds)", { studentIds })
        .andWhere("att.date = :date", { date })
        .getMany();

      for (const record of attRecords) {
        attendanceMap[record.student_id] = record;
      }
    }

    return students.map((st) => {
      const att = attendanceMap[st.id];
      const studentObj = {
        id: String(st.id),
        schoolId: String(st.school_id),
        schoolAcademicYearId: st.school_academic_year_id ? String(st.school_academic_year_id) : null,
        userId: st.user_id ? String(st.user_id) : null,
        name: st.user ? st.user.name : "",
        email: st.user ? st.user.email : "",
        phone: st.user?.phone || st.whatsapp_no || "",
        avatarUrl: st.user?.avatar_url || null,
        rollNo: st.roll_no || "",
        registrationNo: st.registration_no || "",
        scholarNo: st.scholar_no || "",
        dob: st.dob || "",
        gender: st.gender || "",
        bloodGroup: st.blood_group || "",
        casteCategory: st.caste_category || "",
        fatherName: st.father_name || "",
        motherName: st.mother_name || "",
        guardianName: st.guardian_name || "",
        guardianPhone: st.guardian_phone || "",
        whatsappNo: st.whatsapp_no || "",
        address: st.address || "",
        admissionDate: st.admission_date || "",
        medium: st.medium || "",
        academicYear: st.academic_year || "",
      };

      return {
        id: String(st.id),
        studentId: String(st.id),
        userId: st.user_id ? String(st.user_id) : null,
        name: st.user ? st.user.name : "",
        studentName: st.user ? st.user.name : "",
        email: st.user ? st.user.email : "",
        phone: st.user?.phone || st.whatsapp_no || "",
        avatarUrl: st.user?.avatar_url || null,
        rollNo: st.roll_no || "",
        rollNumber: st.roll_no || "",
        registrationNo: st.registration_no || "",
        scholarNo: st.scholar_no || "",
        classId: st.class_id ? String(st.class_id) : "",
        className: st.class ? st.class.name : "",
        class: st.class ? st.class.name : "",
        divisionId: st.division_master_id ? String(st.division_master_id) : (st.class?.division_master_id ? String(st.class.division_master_id) : ""),
        divisionName: st.division_master ? st.division_master.name : (st.class ? st.class.division || "" : ""),
        section: st.division_master ? st.division_master.name : (st.class ? st.class.division || "" : ""),
        gender: st.gender || "",
        dob: st.dob || "",
        fatherName: st.father_name || st.guardian_name || "",
        motherName: st.mother_name || "",
        guardianName: st.guardian_name || st.father_name || "",
        guardianPhone: st.guardian_phone || "",
        status: att ? att.status : null,
        attendanceStatus: att ? att.status : null,
        attendanceId: att ? String(att.id) : null,
        remarks: att ? att.remarks : null,
        studentDetail: studentObj,
      };
    });
  }

  async getSampleTemplate(
    schoolId?: number,
    academicYearHeader?: string,
    classId?: number,
    divisionId?: number,
    date?: string,
    currentUser?: any
  ) {
    const students = await this.getAttendanceStudentList(
      schoolId,
      academicYearHeader,
      classId,
      divisionId,
      undefined,
      date,
      currentUser
    );

    const targetDate = date || new Date().toISOString().split("T")[0];

    return students.map((st: any) => ({
      "Registration No": st.registrationNo || st.registration_no || "N/A",
      "Student Name": st.studentName || st.name || "Student",
      "Roll No": st.rollNumber || st.rollNo || st.roll_no || "",
      "Class": st.className || st.class || "",
      "Division": st.divisionName || st.section || "",
      "Date": targetDate,
      "Status": st.attendanceStatus || st.status || "present",
      "Remarks": st.remarks || "",
      "classId": st.classId || "",
      "divisionId": st.divisionId || ""
    }));
  }
}
