import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import PDFDocument from "pdfkit";
import { Fee } from "../../entities/fee.entity.js";
import { FeeReceipt } from "../../entities/fee-receipt.entity.js";
import { SchoolClassFeeStructure } from "../../entities/class-fee-structure.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { School } from "../../entities/school.entity.js";
import { FeePaymentSchedule } from "../../entities/fee-payment-schedule.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";
import { toIntID } from "../../db/index.js";

const MONTH_NAMES_MAP: Record<string, string> = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(Fee)
    private feeRepo: Repository<Fee>,
    @InjectRepository(FeeReceipt)
    private feeReceiptRepo: Repository<FeeReceipt>,
    @InjectRepository(SchoolClassFeeStructure)
    private classFeeStructRepo: Repository<SchoolClassFeeStructure>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(SchoolClass)
    private schoolClassRepo: Repository<SchoolClass>,
    @InjectRepository(School)
    private schoolRepo: Repository<School>,
    @InjectRepository(FeePaymentSchedule)
    private scheduleRepo: Repository<FeePaymentSchedule>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Inject(AcademicYearService)
    private ayService: AcademicYearService,
  ) { }

  private formatFeeComponentDescription(
    feeName: string,
    frequency: string,
    feeType: string,
    monthLabel: string,
    multiplier: number,
    amount: number,
  ): string {
    let name = feeName || "Fee";
    const isMonthly =
      frequency === "monthly" ||
      feeType === "tuition" ||
      name.toLowerCase().includes("tuition");

    if (isMonthly && monthLabel) {
      let cleanName = name
        .replace(/^monthly\s+/i, "")
        .replace(new RegExp(`^${monthLabel}\\s*(month)?\\s*`, "i"), "")
        .trim();

      if (!cleanName.toLowerCase().endsWith("fee")) {
        cleanName += " Fee";
      }

      name = `${monthLabel} Month ${cleanName}`;
    }

    if (frequency === "monthly" && multiplier > 1) {
      return `${name} (${multiplier}x = ₹${amount})`;
    } else {
      return `${name} (₹${amount})`;
    }
  }

  private mapFeeEntity(f: Fee) {
    const todayStr = new Date().toISOString().split("T")[0];
    const isOverdue = f.status === "pending" && Boolean(f.due_date && f.due_date < todayStr);

    return {
      id: String(f.id),
      studentId: String(f.student_id),
      studentName: f.student?.user ? f.student.user.name : "",
      rollNumber: f.student ? f.student.roll_no : "",
      class: f.student?.class ? `${f.student.class.name}-${f.student.class.division || ""}` : "",
      amount: Number(f.amount),
      type: f.fee_type,
      feeType: f.fee_type,
      month: f.month || undefined,
      dueDate: f.due_date,
      paidDate: f.paid_at ? new Date(f.paid_at).toISOString() : null,
      status: isOverdue && f.status === 'pending' ? 'overdue' : f.status,
      remarks: f.description,
      schoolId: String(f.school_id),
      receiptId: f.receipt_id ? String(f.receipt_id) : undefined,
      receiptNumber: f.receipt_number || undefined,
      scheduleId: f.schedule_id ? String(f.schedule_id) : undefined,
      installmentName: f.installment_name || undefined,
      sessionStart: f.session_start || undefined,
      isOverdue,
      createdAt: f.created_at ? new Date(f.created_at).toISOString() : undefined,
    };
  }

  private async getStudentScope(currentUser?: any): Promise<{
    isStudent: boolean;
    studentId: number | null;
    userId: number | null;
  }> {
    if (!currentUser) {
      return { isStudent: false, studentId: null, userId: null };
    }

    let userRole = currentUser?.role ? String(currentUser.role).toLowerCase() : "";
    const rawUserId = currentUser.sub || currentUser.id || currentUser.userId;
    const userId = rawUserId ? toIntID(String(rawUserId)) : null;

    if (userId && !userRole) {
      const dbUser = await this.userRepo.findOne({ where: { id: userId } });
      if (dbUser) {
        userRole = String(dbUser.role || "").toLowerCase();
      }
    }

    const isStudent = userRole === "student";
    let studentId: number | null = null;

    if (isStudent && userId) {
      const studentRecord = await this.studentRepo.findOne({
        where: [
          { user_id: userId, is_deleted: false },
          { user_id: userId },
        ],
      });
      if (studentRecord) {
        studentId = studentRecord.id;
      }
    }

    return { isStudent, studentId, userId };
  }

  async getFees(params: {
    schoolId?: number;
    academicYearHeader?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    feeType?: string;
    month?: string;
    studentId?: number;
    scheduleId?: number;
    installmentName?: string;
    sessionStart?: string;
    classMasterId?: number;
    currentUser?: any;
  }) {
    const {
      schoolId,
      academicYearHeader,
      page,
      limit,
      search,
      status,
      feeType,
      month,
      studentId,
      scheduleId,
      installmentName,
      sessionStart,
      classMasterId,
      currentUser,
    } = params;

    const { isStudent, studentId: loggedInStudentId, userId } = await this.getStudentScope(currentUser);

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }
    const qb = this.feeRepo
      .createQueryBuilder("f")
      .innerJoinAndSelect("f.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .leftJoinAndSelect("f.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("f.school_id = :schoolId", { schoolId });
    }
    if (sayId) {
      qb.andWhere("say.id = :sayId", { sayId });
    }

    // Role-based visibility:
    // If student is logged in, show ONLY their own fee records.
    // If admin, school_admin, etc. show fees for all classes/students unless filtered by query params.
    if (isStudent) {
      if (loggedInStudentId) {
        qb.andWhere("f.student_id = :loggedInStudentId", { loggedInStudentId });
      } else if (userId) {
        qb.andWhere("st.user_id = :loggedInUserId", { loggedInUserId: userId });
      } else {
        qb.andWhere("1 = 0");
      }
    } else {
      if (studentId) {
        qb.andWhere("f.student_id = :studentId", { studentId });
      }
      if (classMasterId) {
        qb.andWhere("c.class_master_id = :classMasterId", { classMasterId });
      }
    }
    if (status && status !== "all") {
      const todayStr = new Date().toISOString().split("T")[0];
      if (status === "overdue") {
        qb.andWhere("f.status = 'pending' AND f.due_date < :todayStr", { todayStr });
      } else if (status === "pending") {
        qb.andWhere("f.status = 'pending' AND (f.due_date IS NULL OR f.due_date >= :todayStr)", { todayStr });
      } else {
        qb.andWhere("f.status = :status", { status });
      }
    }
    if (feeType && feeType !== "all") {
      qb.andWhere("f.fee_type = :feeType", { feeType });
    }
    if (month && month !== "all") {
      qb.andWhere("(f.month = :month OR f.month LIKE :monthLike)", {
        month,
        monthLike: `%${month}%`,
      });
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE :q OR LOWER(st.roll_no) LIKE :q OR LOWER(c.name) LIKE :q OR LOWER(f.fee_type) LIKE :q OR LOWER(f.description) LIKE :q OR LOWER(f.month) LIKE :q OR LOWER(f.installment_name) LIKE :q OR LOWER(f.receipt_number) LIKE :q)",
        { q }
      );
    }

    qb.orderBy("f.due_date", "ASC");

    if (page || limit) {
      const pageNum = Math.max(1, page || 1);
      const limitNum = Math.max(1, limit || 10);
      const skip = (pageNum - 1) * limitNum;

      qb.skip(skip).take(limitNum);
      const [fees, total] = await qb.getManyAndCount();
      const data = fees.map((f) => this.mapFeeEntity(f));

      return {
        data,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      };
    }

    const fees = await qb.getMany();
    return fees.map((f) => this.mapFeeEntity(f));
  }

  async getFeeById(feeId: number) {
    return this.feeRepo.findOne({ where: { id: feeId } });
  }

  async getFullFeeRecord(feeId: number) {
    const feeObj = await this.feeRepo.findOne({
      where: { id: feeId },
      relations: { student: { user: true, class: true } },
    });
    if (!feeObj) return null;

    return this.mapFeeEntity(feeObj);
  }

  async createFee(schoolId: number, data: any) {
    const { studentId, amount, feeType, dueDate, month, paidDate, status, remarks, paymentMethod } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "hostel", "lab", "annual", "computer", "uniforms", "other"];

    let rawItems: any[] = [];
    if (Array.isArray(data.items) && data.items.length > 0) {
      rawItems = data.items;
    } else if (Array.isArray(data.selectedFeeItems) && data.selectedFeeItems.length > 0) {
      rawItems = data.selectedFeeItems.filter((i: any) => i.selected || Number(i.amount) > 0);
    }

    if (rawItems.length === 0) {
      rawItems = [{
        feeType: feeType || "tuition",
        amount: Number(amount || 0),
        remarks: remarks,
      }];
    }

    let monthsToProcess: string[] = [];
    if (Array.isArray(data.selectedMonths) && data.selectedMonths.length > 0) {
      monthsToProcess = data.selectedMonths;
    } else if (Array.isArray(data.months) && data.months.length > 0) {
      monthsToProcess = data.months;
    } else {
      monthsToProcess = [month || new Date().toISOString().slice(0, 7)];
    }

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId);
    }

    const itemsSum = rawItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalAmount = itemsSum * monthsToProcess.length;
    const monthsCovered = monthsToProcess.sort().join(", ");

    const nowStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${nowStr}-${randomSuffix}`;

    const receipt = this.feeReceiptRepo.create({
      receipt_number: receiptNumber,
      school_id: schoolId,
      student_id: studentId,
      total_amount: totalAmount,
      payment_method: paymentMethod || "cash",
      months_covered: monthsCovered,
      remarks: remarks || null,
    });

    const savedReceipt = await this.feeReceiptRepo.save(receipt);
    const receiptId = savedReceipt.id;

    const createdFeeIds: number[] = [];
    const paymentTime = (status === "paid" || paidDate) ? (paidDate ? new Date(paidDate) : new Date()) : null;

    for (const mStr of monthsToProcess) {
      for (const item of rawItems) {
        const dbFeeType = validFeeTypes.includes(item.feeType) ? item.feeType : (item.feeType || "other");
        const itemDesc = item.remarks || remarks || (item.feeType !== dbFeeType ? item.feeType : null);

        const newFee = this.feeRepo.create({
          school_id: schoolId,
          school_academic_year_id: sayId || undefined,
          student_id: studentId,
          receipt_id: receiptId,
          receipt_number: receiptNumber,
          amount: Number(item.amount || 0),
          fee_type: dbFeeType,
          month: mStr,
          description: itemDesc,
          due_date: dueDate || new Date().toISOString().split("T")[0],
          status: status || "pending",
          paid_at: paymentTime,
        });

        const saved = await this.feeRepo.save(newFee);
        createdFeeIds.push(saved.id);
      }
    }

    return this.getFullFeeRecord(createdFeeIds[0]);
  }

  async updateFee(feeId: number, data: any) {
    const { amount, feeType, remarks, dueDate, month, status, paidDate, paymentMethod } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "hostel", "lab", "annual", "computer", "uniforms", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : (feeType || "other");
    const description = remarks || (feeType !== dbFeeType ? feeType : null);

    const existing = await this.feeRepo.findOne({ where: { id: feeId } });
    let receiptId = existing?.receipt_id || null;
    let receiptNumber = existing?.receipt_number || null;

    if (status === "paid" && (!receiptId || !receiptNumber)) {
      const nowStr = new Date().toISOString().slice(0, 7).replace("-", "");
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      receiptNumber = `REC-${nowStr}-${randomSuffix}`;

      const receipt = this.feeReceiptRepo.create({
        receipt_number: receiptNumber,
        school_id: existing?.school_id || 1,
        student_id: existing?.student_id || 1,
        total_amount: Number(amount || existing?.amount || 0),
        payment_method: paymentMethod || "cash",
        months_covered: month || existing?.month || new Date().toISOString().slice(0, 7),
        remarks: description || null,
      });

      const savedReceipt = await this.feeReceiptRepo.save(receipt);
      receiptId = savedReceipt.id;
    }

    await this.feeRepo.update(feeId, {
      amount,
      fee_type: dbFeeType,
      month,
      description,
      due_date: dueDate,
      status,
      paid_at: status === "paid" ? (paidDate ? new Date(paidDate) : (existing?.paid_at || new Date())) : null,
      receipt_id: receiptId || undefined,
      receipt_number: receiptNumber || undefined,
    });
  }

  async deleteFee(feeId: number) {
    await this.feeRepo.delete(feeId);
  }

  // --- Class-Wise Fee Structure Methods ---

  async getClassFeeStructures(schoolId?: number, classMasterId?: number) {
    const qb = this.classFeeStructRepo
      .createQueryBuilder("cfs")
      .leftJoinAndSelect("cfs.class_master", "cm");

    if (schoolId) {
      qb.andWhere("cfs.school_id = :schoolId", { schoolId });
    }
    if (classMasterId) {
      qb.andWhere("cfs.class_master_id = :classMasterId", { classMasterId });
    }

    qb.orderBy("cm.grade_level", "ASC").addOrderBy("cfs.fee_name", "ASC");

    const list = await qb.getMany();
    return list.map((item) => ({
      id: String(item.id),
      schoolId: String(item.school_id),
      classMasterId: String(item.class_master_id),
      className: item.class_master ? item.class_master.name : "",
      feeType: item.fee_type,
      feeName: item.fee_name,
      amount: Number(item.amount),
      frequency: item.frequency,
      dueDay: item.due_day,
      month: item.month || undefined,
      isMandatory: item.is_mandatory,
      description: item.description,
    }));
  }

  async createOrUpdateClassFeeStructure(schoolId: number, data: any) {
    const { id, classMasterId, classMasterIds, feeType, feeName, amount, frequency, dueDay, month, isMandatory, description } = data;

    if (id) {
      await this.classFeeStructRepo.update(id, {
        class_master_id: classMasterId || (Array.isArray(classMasterIds) ? classMasterIds[0] : undefined),
        fee_type: feeType || "tuition",
        fee_name: feeName,
        amount: amount || 0,
        frequency: frequency || "monthly",
        due_day: dueDay || 10,
        month,
        is_mandatory: isMandatory !== undefined ? isMandatory : true,
        description,
      });
      return id;
    }

    if (Array.isArray(classMasterIds) && classMasterIds.length > 0) {
      const createdIds: number[] = [];
      for (const cmId of classMasterIds) {
        const newStruct = this.classFeeStructRepo.create({
          school_id: schoolId,
          class_master_id: Number(cmId),
          fee_type: feeType || "tuition",
          fee_name: feeName,
          amount: amount || 0,
          frequency: frequency || "monthly",
          due_day: dueDay || 10,
          month,
          is_mandatory: isMandatory !== undefined ? isMandatory : true,
          description,
        });
        const saved = await this.classFeeStructRepo.save(newStruct);
        createdIds.push(saved.id);
      }
      return createdIds[0];
    }

    const newStruct = this.classFeeStructRepo.create({
      school_id: schoolId,
      class_master_id: Number(classMasterId),
      fee_type: feeType || "tuition",
      fee_name: feeName,
      amount: amount || 0,
      frequency: frequency || "monthly",
      due_day: dueDay || 10,
      month,
      is_mandatory: isMandatory !== undefined ? isMandatory : true,
      description,
    });

    const saved = await this.classFeeStructRepo.save(newStruct);
    return saved.id;
  }

  async deleteClassFeeStructure(id: number) {
    await this.classFeeStructRepo.delete(id);
  }

  async generateInvoicesFromClassStructure(
    schoolId: number,
    param2: any,
    dueDateArg?: string,
    monthArg?: string,
    academicYearHeader?: string
  ) {
    // Support both object param options or legacy positional params
    let classMasterId: number | string | undefined;
    let dueDate: string | undefined;
    let month: string | undefined;
    let scheduleId: number | undefined;
    let installmentName: string | undefined;
    let sessionStart: string | undefined;
    let installmentFormat: string | undefined;
    let multiplier: number = 1;

    if (typeof param2 === "object" && param2 !== null) {
      classMasterId = param2.classMasterId;
      dueDate = param2.dueDate;
      month = param2.month;
      scheduleId = (param2.scheduleId && param2.scheduleId !== "entire_year") ? Number(param2.scheduleId) : undefined;
      installmentName = param2.installmentName;
      sessionStart = param2.sessionStart;
      installmentFormat = param2.installmentFormat;
      multiplier = Number(param2.multiplier || (installmentFormat === "quarterly" ? 3 : 1));
    } else {
      classMasterId = param2;
      dueDate = dueDateArg;
      month = monthArg;
    }

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    // Determine target classes
    const isAllClasses = !classMasterId || classMasterId === "all" || classMasterId === 0;

    let structuresQuery = this.classFeeStructRepo
      .createQueryBuilder("cfs")
      .where("cfs.school_id = :schoolId", { schoolId });

    if (!isAllClasses) {
      structuresQuery = structuresQuery.andWhere("cfs.class_master_id = :classMasterId", {
        classMasterId: Number(classMasterId),
      });
    }

    const structures = await structuresQuery.getMany();

    if (structures.length === 0) {
      return {
        count: 0,
        message: isAllClasses
          ? "No fee structures configured for any class in this school."
          : "No fee structures configured for the selected class level.",
      };
    }

    // Find school classes and enrolled students
    let schoolClassesQuery = this.schoolClassRepo
      .createQueryBuilder("sc")
      .where("sc.school_id = :schoolId", { schoolId });

    if (!isAllClasses) {
      schoolClassesQuery = schoolClassesQuery.andWhere("sc.class_master_id = :classMasterId", {
        classMasterId: Number(classMasterId),
      });
    }

    const schoolClasses = await schoolClassesQuery.getMany();
    const classIds = schoolClasses.map((sc) => sc.id);

    if (classIds.length === 0) {
      return { count: 0, message: "No active classes found for this grade level." };
    }

    const students = await this.studentRepo
      .createQueryBuilder("st")
      .where("st.school_id = :schoolId", { schoolId })
      .andWhere("st.class_id IN (:...classIds)", { classIds })
      .leftJoinAndSelect("st.class", "sc")
      .getMany();

    if (students.length === 0) {
      return { count: 0, message: "No active students enrolled in the target classes." };
    }

    const isEntireYear = Boolean(
      (typeof param2 === "object" && param2 !== null && (param2.isEntireYear || param2.entireYear || param2.scheduleId === "entire_year")) ||
      scheduleId === ("entire_year" as any) ||
      installmentName === "entire_year"
    );

    if (isEntireYear) {
      let schedulesList = await this.scheduleRepo.find({
        where: {
          school_id: schoolId,
          ...(sessionStart ? { session_start: sessionStart } : {}),
          ...(installmentFormat ? { installment_format: installmentFormat } : {}),
          is_active: true,
        },
        order: { order_seq: "ASC" },
      });

      // If no schedules found with specific session/format, load any configured active schedules for this school
      if (schedulesList.length === 0) {
        schedulesList = await this.scheduleRepo.find({
          where: { school_id: schoolId, is_active: true },
          order: { order_seq: "ASC" },
        });
      }

      // If still no schedule exists in DB yet, auto-seed defaults using school settings
      if (schedulesList.length === 0) {
        const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
        const activeSession = (sessionStart || school?.fee_session_start || "april") as "april" | "july";
        const activeFormat = (installmentFormat || school?.fee_frequency || "monthly") as "monthly" | "quarterly";

        await this.generateSchoolDefaultSchedule(
          schoolId,
          activeSession,
          activeFormat,
          undefined,
          10,
          academicYearHeader
        );
        schedulesList = await this.scheduleRepo.find({
          where: {
            school_id: schoolId,
            session_start: activeSession,
            installment_format: activeFormat,
          },
          order: { order_seq: "ASC" },
        });
      }

      let totalCreated = 0;
      let totalSkipped = 0;

      let schoolAcademicYear = academicYearHeader;
      if (!schoolAcademicYear && schoolId) {
        const schoolRec = await this.schoolRepo.findOne({ where: { id: schoolId } });
        schoolAcademicYear = schoolRec?.academic_year || undefined;
      }
      if (!schoolAcademicYear) {
        schoolAcademicYear = String(new Date().getFullYear());
      }

      for (const schedItem of schedulesList) {
        const dueDay = schedItem.due_day || 10;
        const computed = this.calculateScheduleDueDate(
          schedItem.month_payable,
          schedItem.session_start,
          dueDay,
          schedItem.academic_year || schoolAcademicYear,
          schedItem.fee_for_months
        );

        const itemDueDate = schedItem.due_date || computed.dueDate;
        const itemMonth = computed.itemMonth;
        const coveredCodes = schedItem.fee_for_months
          ? schedItem.fee_for_months.split(",").map((m) => m.trim().padStart(2, "0"))
          : [];
        const itemMultiplier = Number(schedItem.month_multiplier || (schedItem.installment_format === "quarterly" ? 3 : 1));

        const coveredMonthNames = coveredCodes.map((c) => MONTH_NAMES_MAP[c]).filter(Boolean);
        const fallbackCoverage = coveredMonthNames.length > 0 ? coveredMonthNames.join(" + ") : "";

        const installmentLabel = schedItem.month_payable;
        const coverageLabel = schedItem.notes
          ? schedItem.notes
          : fallbackCoverage;

        const monthLabel = coveredMonthNames.length > 0
          ? coveredMonthNames.join(" + ")
          : (schedItem.notes ? schedItem.notes.replace(/\s*\+\s*.*term.*/i, "").trim() : "");

        const itemNotesStr = (schedItem.notes || "").toLowerCase();
        const itemNameStr = (schedItem.month_payable || "").toLowerCase();

        const isT2 =
          /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(itemNotesStr) ||
          /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(itemNameStr);

        const isT1 =
          !isT2 && (
            /\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(itemNotesStr) ||
            /\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(itemNameStr) ||
            /(^|[^\w])i\s*term\b/i.test(itemNotesStr) ||
            /(^|[^\w])i\s*term\b/i.test(itemNameStr)
          );

        for (const student of students) {
          const classMasterIdForStudent = student.class?.class_master_id;
          if (!classMasterIdForStudent) continue;

          // Filter applicable structures for this class & installment
          const applicable = structures.filter((struct) => {
            if (struct.class_master_id !== classMasterIdForStudent) return false;

            const feeNameLower = (struct.fee_name || "").toLowerCase();
            const feeTypeLower = (struct.fee_type || "").toLowerCase();
            const freqLower = (struct.frequency || "").toLowerCase();

            const isTerm2Struct =
              /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(feeNameLower) ||
              (feeTypeLower === "term" && struct.month === "02");

            const isTerm1Struct =
              !isTerm2Struct && (
                /\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(feeNameLower) ||
                /(^|[^\w])i\s*term\b/i.test(feeNameLower) ||
                (feeTypeLower === "term" && struct.month === "01")
              );

            const isGenericTermStruct =
              feeTypeLower === "term" ||
              freqLower === "term" ||
              feeNameLower.includes("term fee") ||
              feeNameLower.includes("term exam");

            if (isTerm1Struct) return isT1;
            if (isTerm2Struct) return isT2;
            if (isGenericTermStruct) return isT1 || isT2;

            if (!struct.month || struct.month === "all" || struct.month === "every_month" || freqLower === "monthly") {
              return true;
            }

            const structMonthCode = struct.month.trim().padStart(2, "0");
            if (coveredCodes.length > 0 && coveredCodes.includes(structMonthCode)) {
              return true;
            }

            const targetMonthStr = itemMonth.toLowerCase();
            const structMonthStr = struct.month.toLowerCase();
            return (
              targetMonthStr.includes(structMonthStr) ||
              structMonthStr.includes(targetMonthStr) ||
              targetMonthStr.endsWith("-" + structMonthStr)
            );
          });

          if (applicable.length === 0) continue;

          // Prevent duplicate billing for this student and installment
          const existing = await this.feeRepo.findOne({
            where: [
              { school_id: schoolId, student_id: student.id, schedule_id: schedItem.id },
              { school_id: schoolId, student_id: student.id, month: itemMonth, installment_name: schedItem.month_payable },
            ],
          });

          if (existing) {
            totalSkipped++;
            continue;
          }

          let totalAmount = 0;
          const componentBreakdown: string[] = [];

          for (const struct of applicable) {
            let componentAmount = Number(struct.amount || 0);
            if (struct.frequency === "monthly" && itemMultiplier > 1) {
              componentAmount = componentAmount * itemMultiplier;
            }
            totalAmount += componentAmount;
            componentBreakdown.push(
              this.formatFeeComponentDescription(
                struct.fee_name,
                struct.frequency,
                struct.fee_type,
                monthLabel,
                itemMultiplier,
                componentAmount,
              ),
            );
          }

          const instTitle = installmentLabel.toLowerCase().endsWith("fee")
            ? installmentLabel
            : `${installmentLabel} Fee`;

          const fullDescription = coverageLabel
            ? `${instTitle} (${coverageLabel}): ${componentBreakdown.join(" + ")}`
            : `${instTitle}: ${componentBreakdown.join(" + ")}`;

          const newFee = this.feeRepo.create({
            school_id: schoolId,
            school_academic_year_id: sayId || undefined,
            student_id: student.id,
            amount: totalAmount,
            fee_type: "tuition",
            description: fullDescription,
            month: itemMonth,
            due_date: itemDueDate,
            status: "pending",
            schedule_id: schedItem.id,
            installment_name: installmentLabel,
            session_start: schedItem.session_start,
          });

          await this.feeRepo.save(newFee);
          totalCreated++;
        }
      }

      return {
        count: totalCreated,
        skipped: totalSkipped,
        message: `Successfully generated ${totalCreated} fee invoices for the entire academic year (${schedulesList.length} installments) across ${students.length} students.${totalSkipped > 0 ? ` (${totalSkipped} existing invoices preserved)` : ""
          }`,
      };
    }

    let createdCount = 0;
    let skippedCount = 0;

    let schoolAcademicYear = academicYearHeader;
    if (!schoolAcademicYear && schoolId) {
      const schoolRec = await this.schoolRepo.findOne({ where: { id: schoolId } });
      schoolAcademicYear = schoolRec?.academic_year || undefined;
    }
    if (!schoolAcademicYear) {
      schoolAcademicYear = String(new Date().getFullYear());
    }

    // Load schedule item details if scheduleId provided
    let scheduleItem: FeePaymentSchedule | null = null;
    if (scheduleId) {
      scheduleItem = await this.scheduleRepo.findOne({ where: { id: scheduleId } });
    }

    const targetInstallment = installmentName || scheduleItem?.month_payable || month || "July";
    const computed = this.calculateScheduleDueDate(
      targetInstallment,
      scheduleItem?.session_start || sessionStart || "april",
      scheduleItem?.due_day || 10,
      scheduleItem?.academic_year || schoolAcademicYear,
      scheduleItem?.fee_for_months
    );

    const targetDueDate = dueDate || scheduleItem?.due_date || computed.dueDate;
    const targetMonth = month || computed.itemMonth;

    const coveredMonthCodes = scheduleItem?.fee_for_months
      ? scheduleItem.fee_for_months.split(",").map((m) => m.trim().padStart(2, "0"))
      : [];
    const coveredMonthNames = coveredMonthCodes.map((c) => MONTH_NAMES_MAP[c]).filter(Boolean);
    const fallbackCoverage = coveredMonthNames.length > 0 ? coveredMonthNames.join(" + ") : "";

    const installmentLabel = scheduleItem?.month_payable || targetInstallment;
    const coverageLabel = scheduleItem?.notes
      ? scheduleItem.notes
      : fallbackCoverage;

    const monthLabel = coveredMonthNames.length > 0
      ? coveredMonthNames.join(" + ")
      : (scheduleItem?.notes ? scheduleItem.notes.replace(/\s*\+\s*.*term.*/i, "").trim() : "");

    const notesStr = (scheduleItem?.notes || "").toLowerCase();
    const instNameStr = (installmentName || "").toLowerCase();

    // Check Term 2 first (II Term / Term 2)
    const isTerm2Applicable =
      /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(notesStr) ||
      /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(instNameStr);

    // Term 1 (I Term / Term 1) - must not match when Term 2 is applicable
    const isTerm1Applicable =
      !isTerm2Applicable &&
      (/\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(notesStr) ||
        /\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(instNameStr) ||
        /(^|[^\w])i\s*term\b/i.test(notesStr) ||
        /(^|[^\w])i\s*term\b/i.test(instNameStr));

    // Dynamic multiplier: use scheduleItem multiplier if available, otherwise passed multiplier
    const activeMultiplier = Number(
      scheduleItem?.month_multiplier || multiplier || (installmentFormat === "quarterly" ? 3 : 1)
    );

    // Filter structures matching class, schedule covered months, and term fee if applicable
    const getApplicableStructures = (classMasterIdNum: number) => {
      return structures.filter((struct) => {
        if (struct.class_master_id !== classMasterIdNum) return false;

        const feeNameLower = (struct.fee_name || "").toLowerCase();
        const feeTypeLower = (struct.fee_type || "").toLowerCase();
        const freqLower = (struct.frequency || "").toLowerCase();

        const isTerm2Struct =
          /\b(term\s*2|term-2|ii\s*term|2nd\s*term|second\s*term)\b/i.test(feeNameLower) ||
          (feeTypeLower === "term" && struct.month === "02");

        const isTerm1Struct =
          !isTerm2Struct &&
          (/\b(term\s*1|term-1|1st\s*term|first\s*term)\b/i.test(feeNameLower) ||
            /(^|[^\w])i\s*term\b/i.test(feeNameLower) ||
            (feeTypeLower === "term" && struct.month === "01"));

        const isGenericTermStruct =
          feeTypeLower === "term" ||
          freqLower === "term" ||
          feeNameLower.includes("term fee") ||
          feeNameLower.includes("term exam");

        // Explicit Term 1 structure
        if (isTerm1Struct) {
          return isTerm1Applicable;
        }

        // Explicit Term 2 structure
        if (isTerm2Struct) {
          return isTerm2Applicable;
        }

        // Generic Term structure
        if (isGenericTermStruct) {
          return isTerm1Applicable || isTerm2Applicable;
        }

        // Recurring monthly components (e.g. Monthly Tuition Fee)
        if (!struct.month || struct.month === "all" || struct.month === "every_month" || freqLower === "monthly") {
          return true;
        }

        // Specific month code matching schedule covered months
        const structMonthCode = struct.month.trim().padStart(2, "0");
        if (coveredMonthCodes.length > 0 && coveredMonthCodes.includes(structMonthCode)) {
          return true;
        }

        const targetMonthStr = targetMonth.toLowerCase();
        const structMonthStr = struct.month.toLowerCase();
        return (
          targetMonthStr.includes(structMonthStr) ||
          structMonthStr.includes(targetMonthStr) ||
          targetMonthStr.endsWith("-" + structMonthStr)
        );
      });
    };

    for (const student of students) {
      const classMasterIdForStudent = student.class?.class_master_id;
      if (!classMasterIdForStudent) continue;

      const applicableStructures = getApplicableStructures(classMasterIdForStudent);
      if (applicableStructures.length === 0) continue;

      // Prevent duplicate billing: 1 combined entry per student per schedule installment
      const whereClause: any = {
        school_id: schoolId,
        student_id: student.id,
      };
      if (scheduleId) {
        whereClause.schedule_id = scheduleId;
      } else {
        whereClause.month = targetMonth;
        whereClause.installment_name = targetInstallment;
      }

      const existingInvoice = await this.feeRepo.findOne({ where: whereClause });

      if (existingInvoice) {
        skippedCount++;
        continue;
      }

      // Consolidate all applicable components into ONE combined invoice entry
      let totalAmount = 0;
      const componentBreakdown: string[] = [];
      const primaryFeeType = "tuition";

      for (const struct of applicableStructures) {
        let componentAmount = Number(struct.amount || 0);
        if (struct.frequency === "monthly" && activeMultiplier > 1) {
          componentAmount = componentAmount * activeMultiplier;
        }
        totalAmount += componentAmount;
        componentBreakdown.push(
          this.formatFeeComponentDescription(
            struct.fee_name,
            struct.frequency,
            struct.fee_type,
            monthLabel,
            activeMultiplier,
            componentAmount,
          ),
        );
      }

      const instTitle = installmentLabel.toLowerCase().endsWith("fee")
        ? installmentLabel
        : `${installmentLabel} Fee`;

      const fullDescription = coverageLabel
        ? `${instTitle} (${coverageLabel}): ${componentBreakdown.join(" + ")}`
        : `${instTitle}: ${componentBreakdown.join(" + ")}`;

      const newFee = this.feeRepo.create({
        school_id: schoolId,
        school_academic_year_id: sayId || undefined,
        student_id: student.id,
        amount: totalAmount,
        fee_type: primaryFeeType,
        description: fullDescription,
        month: targetMonth,
        due_date: targetDueDate,
        status: "pending",
        schedule_id: scheduleId || undefined,
        installment_name: installmentLabel,
        session_start: sessionStart || scheduleItem?.session_start || undefined,
      });

      await this.feeRepo.save(newFee);
      createdCount++;
    }

    return {
      count: createdCount,
      skipped: skippedCount,
      message: `Successfully generated ${createdCount} fee invoices across ${students.length} students.${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ""
        }`,
    };
  }

  // --- Fee Payment Schedules (Version 2) ---

  async getFeeSchedules(
    schoolId: number,
    options?: { sessionStart?: string; format?: string; academicYear?: string }
  ) {
    const qb = this.scheduleRepo
      .createQueryBuilder("fps")
      .where("fps.school_id = :schoolId", { schoolId });

    if (options?.sessionStart && options.sessionStart !== "all") {
      qb.andWhere("fps.session_start = :sessionStart", { sessionStart: options.sessionStart });
    }
    if (options?.format && options.format !== "all") {
      qb.andWhere("fps.installment_format = :format", { format: options.format });
    }
    if (options?.academicYear && options.academicYear !== "all") {
      qb.andWhere("fps.academic_year = :academicYear", { academicYear: options.academicYear });
    }

    qb.orderBy("fps.session_start", "ASC")
      .addOrderBy("fps.installment_format", "ASC")
      .addOrderBy("fps.order_seq", "ASC");

    const items = await qb.getMany();
    return items.map((item) => {
      const computed = this.calculateScheduleDueDate(
        item.month_payable,
        item.session_start,
        item.due_day || 10,
        item.academic_year,
        item.fee_for_months
      );
      return {
        id: String(item.id),
        schoolId: String(item.school_id),
        scheduleName: item.schedule_name || `${item.session_start.toUpperCase()} ${item.installment_format}`,
        sessionStart: item.session_start,
        installmentFormat: item.installment_format,
        orderSeq: item.order_seq,
        monthPayable: item.month_payable,
        feeForMonths: item.fee_for_months,
        monthMultiplier: item.month_multiplier,
        dueDay: item.due_day,
        dueDate: item.due_date || computed.dueDate,
        extensionDays: item.extension_days,
        lateFeeDay: item.late_fee_day,
        lateFeeAmount: Number(item.late_fee_amount || 0),
        paymentMethodsAllowed: item.payment_methods_allowed,
        notes: item.notes,
        isActive: item.is_active,
      };
    });
  }

  async getFeeScheduleById(id: number) {
    const item = await this.scheduleRepo.findOne({ where: { id } });
    if (!item) return null;
    const computed = this.calculateScheduleDueDate(
      item.month_payable,
      item.session_start,
      item.due_day || 10,
      item.academic_year,
      item.fee_for_months
    );
    return {
      id: String(item.id),
      schoolId: String(item.school_id),
      scheduleName: item.schedule_name,
      sessionStart: item.session_start,
      installmentFormat: item.installment_format,
      orderSeq: item.order_seq,
      monthPayable: item.month_payable,
      feeForMonths: item.fee_for_months,
      monthMultiplier: item.month_multiplier,
      dueDay: item.due_day,
      dueDate: item.due_date || computed.dueDate,
      extensionDays: item.extension_days,
      lateFeeDay: item.late_fee_day,
      lateFeeAmount: Number(item.late_fee_amount || 0),
      paymentMethodsAllowed: item.payment_methods_allowed,
      notes: item.notes,
      isActive: item.is_active,
    };
  }

  async createOrUpdateFeeScheduleItem(schoolId: number, academicYearHeader: string, data: any) {
    const {
      id,
      scheduleName,
      sessionStart = "april",
      installmentFormat = "monthly",
      orderSeq = 1,
      monthPayable,
      feeForMonths,
      monthMultiplier,
      dueDay = 10,
      dueDate,
      extensionDays = 5,
      lateFeeDay = 15,
      lateFeeAmount = 0,
      paymentMethodsAllowed = "cash,card,online,cheque,upi",
      notes,
      isActive = true,
      academicYear,
    } = data;

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    const multiplier = monthMultiplier || (installmentFormat === "quarterly" ? 3 : 1);

    if (id) {
      await this.scheduleRepo.update(Number(id), {
        schedule_name: scheduleName,
        session_start: sessionStart,
        installment_format: installmentFormat,
        order_seq: orderSeq,
        month_payable: monthPayable,
        fee_for_months: feeForMonths,
        month_multiplier: multiplier,
        due_day: dueDay,
        due_date: dueDate || null,
        extension_days: extensionDays,
        late_fee_day: lateFeeDay,
        late_fee_amount: lateFeeAmount,
        payment_methods_allowed: paymentMethodsAllowed,
        notes,
        is_active: isActive,
      });
      return id;
    }

    const newItem = this.scheduleRepo.create({
      school_id: schoolId,
      academic_year: academicYear,
      schedule_name: scheduleName || `${sessionStart.toUpperCase()} ${installmentFormat}`,
      session_start: sessionStart,
      installment_format: installmentFormat,
      order_seq: orderSeq,
      month_payable: monthPayable,
      fee_for_months: feeForMonths,
      month_multiplier: multiplier,
      due_day: dueDay,
      due_date: dueDate || null,
      extension_days: extensionDays,
      late_fee_day: lateFeeDay,
      late_fee_amount: lateFeeAmount,
      payment_methods_allowed: paymentMethodsAllowed,
      notes,
      is_active: isActive,
      school_academic_year_id: sayId
    });

    const saved = await this.scheduleRepo.save(newItem);
    return saved.id;
  }

  async deleteFeeScheduleItem(id: number) {
    await this.scheduleRepo.delete(id);
  }

  /**
   * Calculate exact due date (YYYY-MM-DD) and billing month (YYYY-MM)
   * aligned with the academic year calendar rollover rules.
   */
  calculateScheduleDueDate(
    monthPayable: string,
    sessionStart: string,
    dueDay: number = 10,
    academicYearStr?: string | null,
    feeForMonths?: string
  ): { dueDate: string; itemMonth: string; itemYear: number; monthNum: number } {
    let startYear = new Date().getFullYear();
    if (academicYearStr) {
      const match = String(academicYearStr).match(/\b(20\d\d)\b/);
      if (match) {
        startYear = parseInt(match[1], 10);
      }
    }

    const norm = (monthPayable || "").trim().toLowerCase();
    let monthNum = sessionStart === "july" ? 7 : 4;

    if (norm.includes("jan")) monthNum = 1;
    else if (norm.includes("feb")) monthNum = 2;
    else if (norm.includes("mar")) monthNum = 3;
    else if (norm.includes("apr")) monthNum = 4;
    else if (norm.includes("may")) monthNum = 5;
    else if (norm.includes("jun")) monthNum = 6;
    else if (norm.includes("jul")) monthNum = 7;
    else if (norm.includes("aug")) monthNum = 8;
    else if (norm.includes("sep")) monthNum = 9;
    else if (norm.includes("oct")) monthNum = 10;
    else if (norm.includes("nov")) monthNum = 11;
    else if (norm.includes("dec")) monthNum = 12;
    else if (norm.includes("q1") || norm.includes("quarter 1")) monthNum = sessionStart === "july" ? 7 : 4;
    else if (norm.includes("q2") || norm.includes("quarter 2")) monthNum = sessionStart === "july" ? 10 : 7;
    else if (norm.includes("q3") || norm.includes("quarter 3")) monthNum = sessionStart === "july" ? 1 : 10;
    else if (norm.includes("q4") || norm.includes("quarter 4")) monthNum = sessionStart === "july" ? 4 : 1;
    else if (feeForMonths) {
      const first = feeForMonths.split(",")[0]?.trim();
      const p = parseInt(first, 10);
      if (p >= 1 && p <= 12) monthNum = p;
    }

    let itemYear = startYear;
    if (sessionStart === "april") {
      // April (4) to Dec (12) is startYear; Jan (1) to Mar (3) is startYear + 1
      if (monthNum >= 1 && monthNum <= 3) {
        itemYear = startYear + 1;
      }
    } else if (sessionStart === "july") {
      // July (7) to Dec (12) is startYear; Jan (1) to June (6) is startYear + 1
      if (monthNum >= 1 && monthNum <= 6) {
        itemYear = startYear + 1;
      }
    }

    const mm = String(monthNum).padStart(2, "0");
    const clampedDay = Math.min(Math.max(Number(dueDay) || 10, 1), 31);
    const dd = String(clampedDay).padStart(2, "0");
    const dueDate = `${itemYear}-${mm}-${dd}`;
    const itemMonth = `${itemYear}-${mm}`;

    return { dueDate, itemMonth, itemYear, monthNum };
  }

  /**
   * Auto-generate full 12-month or 4-quarter schedule for April-start or July-start
   */
  async generateSchoolDefaultSchedule(
    schoolId: number,
    sessionStart: "april" | "july",
    format: "monthly" | "quarterly",
    academicYear?: string,
    dueDay: number = 10,
    academicYearHeader?: string,
  ) {
    // Remove existing items with matching sessionStart & format for this school to avoid duplicates
    await this.scheduleRepo
      .createQueryBuilder()
      .delete()
      .from(FeePaymentSchedule)
      .where("school_id = :schoolId AND session_start = :sessionStart AND installment_format = :format", {
        schoolId,
        sessionStart,
        format,
      })
      .execute();

    const createdIds: number[] = [];

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    let resolvedAcademicYear = academicYear;
    if (!resolvedAcademicYear && schoolId) {
      const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
      resolvedAcademicYear = school?.academic_year || undefined;
    }
    if (!resolvedAcademicYear) {
      const curYear = new Date().getFullYear();
      resolvedAcademicYear = `${curYear}-${curYear + 1}`;
    }

    if (sessionStart === "april") {
      if (format === "monthly") {
        const aprMonths = [
          { seq: 1, name: "April", code: "06", multiplier: 1, notes: "June + I Term" },
          { seq: 2, name: "June", code: "07", multiplier: 1, notes: "July" },
          { seq: 3, name: "July", code: "08", multiplier: 1, notes: "August" },
          { seq: 4, name: "August", code: "09", multiplier: 1, notes: "September" },
          { seq: 5, name: "September", code: "10", multiplier: 1, notes: "October + II Term" },
          { seq: 6, name: "October", code: "11", multiplier: 1, notes: "November" },
          { seq: 7, name: "November", code: "12", multiplier: 1, notes: "December" },
          { seq: 8, name: "December", code: "01", multiplier: 1, notes: "January" },
          { seq: 9, name: "January", code: "02,03", multiplier: 2, notes: "February + March" },
          { seq: 10, name: "February", code: "04", multiplier: 1, notes: "April" },
          { seq: 11, name: "March", code: "05", multiplier: 1, notes: "May" },
        ];

        for (const m of aprMonths) {
          const computed = this.calculateScheduleDueDate(m.name, sessionStart, dueDay, resolvedAcademicYear, m.code);
          const item = this.scheduleRepo.create({
            school_id: schoolId,
            schedule_name: "April-Start Monthly Plan",
            session_start: "april",
            installment_format: "monthly",
            order_seq: m.seq,
            month_payable: m.name,
            fee_for_months: m.code,
            month_multiplier: m.multiplier,
            due_day: dueDay,
            due_date: computed.dueDate,
            extension_days: 5,
            late_fee_day: 16,
            late_fee_amount: 0,
            notes: m.notes,
            is_active: true,
            academic_year: resolvedAcademicYear,
            school_academic_year_id: sayId
          });
          const saved = await this.scheduleRepo.save(item);
          createdIds.push(saved.id);
        }
      } else {
        // Quarterly April-start
        const aprQuarters = [
          { seq: 1, name: "Quarter 1 (Apr - Jun)", code: "04,05,06", notes: "Q1: April, May, June session fees" },
          { seq: 2, name: "Quarter 2 (Jul - Sep)", code: "07,08,09", notes: "Q2: July, August, September fees" },
          { seq: 3, name: "Quarter 3 (Oct - Dec)", code: "10,11,12", notes: "Q3: October, November, December fees" },
          { seq: 4, name: "Quarter 4 (Jan - Mar)", code: "01,02,03", notes: "Q4: January, February, March fees" },
        ];

        for (const q of aprQuarters) {
          const computed = this.calculateScheduleDueDate(q.name, sessionStart, dueDay, resolvedAcademicYear, q.code);
          const item = this.scheduleRepo.create({
            school_id: schoolId,
            schedule_name: "April-Start Quarterly Plan",
            session_start: "april",
            installment_format: "quarterly",
            order_seq: q.seq,
            month_payable: q.name,
            fee_for_months: q.code,
            month_multiplier: 3,
            due_day: dueDay,
            due_date: computed.dueDate,
            extension_days: 7,
            late_fee_day: 16,
            late_fee_amount: 0,
            notes: q.notes,
            is_active: true,
            academic_year: resolvedAcademicYear,
            school_academic_year_id: sayId
          });
          const saved = await this.scheduleRepo.save(item);
          createdIds.push(saved.id);
        }
      }
    } else {
      // July Start
      if (format === "monthly") {
        // 11 Months as per July school start:
        const julMonths = [
          { seq: 1, name: "July", code: "08", multiplier: 1, notes: "August + I Term" },
          { seq: 2, name: "August", code: "09", multiplier: 1, notes: "September" },
          { seq: 3, name: "September", code: "10", multiplier: 1, notes: "October" },
          { seq: 4, name: "October", code: "11", multiplier: 1, notes: "November" },
          { seq: 5, name: "November", code: "12", multiplier: 1, notes: "December + II Term" },
          { seq: 6, name: "December", code: "01", multiplier: 1, notes: "January" },
          { seq: 7, name: "January", code: "02", multiplier: 1, notes: "February" },
          { seq: 8, name: "February", code: "03", multiplier: 1, notes: "March" },
          { seq: 9, name: "March", code: "04,05", multiplier: 2, notes: "April + May" },
          { seq: 10, name: "April", code: "06", multiplier: 1, notes: "June" },
          { seq: 11, name: "May", code: "07", multiplier: 1, notes: "July" },
        ];

        for (const m of julMonths) {
          const computed = this.calculateScheduleDueDate(m.name, sessionStart, dueDay, resolvedAcademicYear, m.code);
          const item = this.scheduleRepo.create({
            school_id: schoolId,
            schedule_name: "July-Start Monthly Plan",
            session_start: "july",
            installment_format: "monthly",
            order_seq: m.seq,
            month_payable: m.name,
            fee_for_months: m.code,
            month_multiplier: m.multiplier,
            due_day: dueDay,
            due_date: computed.dueDate,
            extension_days: 5,
            late_fee_day: 16,
            late_fee_amount: 0,
            notes: m.notes,
            is_active: true,
            academic_year: resolvedAcademicYear,
            school_academic_year_id: sayId
          });
          const saved = await this.scheduleRepo.save(item);
          createdIds.push(saved.id);
        }
      } else {
        // Quarterly July-start
        const julQuarters = [
          { seq: 1, name: "Quarter 1 (Jul - Sep)", code: "07,08,09", notes: "Q1: July, August, September fees" },
          { seq: 2, name: "Quarter 2 (Oct - Dec)", code: "10,11,12", notes: "Q2: October, November, December fees" },
          { seq: 3, name: "Quarter 3 (Jan - Mar)", code: "01,02,03", notes: "Q3: January, February, March fees" },
          { seq: 4, name: "Quarter 4 (Apr - Jun)", code: "04,05,06", notes: "Q4: April, May, June fees" },
        ];

        for (const q of julQuarters) {
          const computed = this.calculateScheduleDueDate(q.name, sessionStart, dueDay, resolvedAcademicYear, q.code);
          const item = this.scheduleRepo.create({
            school_id: schoolId,
            schedule_name: "July-Start Quarterly Plan",
            session_start: "july",
            installment_format: "quarterly",
            order_seq: q.seq,
            month_payable: q.name,
            fee_for_months: q.code,
            month_multiplier: 3,
            due_day: dueDay,
            due_date: computed.dueDate,
            extension_days: 7,
            late_fee_day: dueDay + 10,
            late_fee_amount: 0,
            notes: q.notes,
            is_active: true,
            academic_year: resolvedAcademicYear,
            school_academic_year_id: sayId
          });
          const saved = await this.scheduleRepo.save(item);
          createdIds.push(saved.id);
        }
      }
    }

    return {
      success: true,
      count: createdIds.length,
      message: `Generated ${createdIds.length} ${sessionStart}-start ${format} schedule installments.`,
    };
  }

  // --- School Fee Settings ---

  async getSchoolFeeSettings(schoolId: number) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException("School not found");
    }

    return {
      schoolId: String(school.id),
      schoolName: school.name,
      academicYear: school.academic_year,
      feeSessionStart: school.fee_session_start || "april",
      feeFrequency: school.fee_frequency || "monthly",
    };
  }

  async updateSchoolFeeSettings(schoolId: number, data: { feeSessionStart?: string; feeFrequency?: string }) {
    await this.schoolRepo.update(schoolId, {
      fee_session_start: data.feeSessionStart || "april",
      fee_frequency: data.feeFrequency || "monthly",
    });

    return this.getSchoolFeeSettings(schoolId);
  }

  // --- Fee Statistics & KPIs ---

  async getFeeStats(schoolId: number, currentUser?: any) {
    const { isStudent, studentId: loggedInStudentId } = await this.getStudentScope(currentUser);

    const whereClause: any = { school_id: schoolId };
    if (isStudent) {
      whereClause.student_id = loggedInStudentId || -1;
    }

    const allFees = await this.feeRepo.find({
      where: whereClause,
    });

    const totalBilled = allFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const paidFees = allFees.filter((f) => f.status === "paid");
    const totalCollected = paidFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const todayStr = new Date().toISOString().split("T")[0];
    const overdueFees = allFees.filter(
      (f) => f.status === "pending" && Boolean(f.due_date && f.due_date < todayStr)
    );
    const totalOverdue = overdueFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const pendingFees = allFees.filter(
      (f) => f.status === "pending" && (!f.due_date || f.due_date >= todayStr)
    );
    const totalPending = pendingFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    // By fee type breakdown
    const typeBreakdown: Record<string, { billed: number; collected: number; count: number }> = {};
    for (const f of allFees) {
      const type = f.fee_type || "other";
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = { billed: 0, collected: 0, count: 0 };
      }
      typeBreakdown[type].billed += Number(f.amount || 0);
      typeBreakdown[type].count += 1;
      if (f.status === "paid") {
        typeBreakdown[type].collected += Number(f.amount || 0);
      }
    }

    return {
      totalBilled,
      totalCollected,
      totalPending,
      totalOverdue,
      totalInvoicesCount: allFees.length,
      paidCount: paidFees.length,
      pendingCount: pendingFees.length,
      overdueCount: overdueFees.length,
      collectionRate,
      typeBreakdown,
    };
  }

  async payFeeBundle(schoolId: number, data: {
    studentId: number;
    feeIds: number[];
    paymentMethod?: string;
    paidDate?: string;
    remarks?: string;
  }) {
    const { studentId, feeIds, paymentMethod = "cash", paidDate, remarks } = data;
    if (!feeIds || feeIds.length === 0) {
      throw new NotFoundException("No fee items provided for payment");
    }

    const fees = await this.feeRepo.find({
      where: { id: In(feeIds) },
      relations: { student: { user: true, class: true } },
    });

    if (fees.length === 0) {
      throw new NotFoundException("Selected fee records not found");
    }

    const totalAmount = fees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const monthsSet = new Set<string>();
    fees.forEach((f) => {
      if (f.month) monthsSet.add(f.month);
    });
    const monthsCovered = Array.from(monthsSet).sort().join(", ");

    const nowStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${nowStr}-${randomSuffix}`;

    const receipt = this.feeReceiptRepo.create({
      receipt_number: receiptNumber,
      school_id: schoolId || fees[0].school_id,
      student_id: studentId || fees[0].student_id,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      months_covered: monthsCovered || "Custom Payment",
      remarks: remarks || null,
    });

    const savedReceipt = await this.feeReceiptRepo.save(receipt);

    const paymentTime = paidDate ? new Date(paidDate) : new Date();
    for (const f of fees) {
      f.status = "paid";
      f.paid_at = paymentTime;
      f.receipt_id = savedReceipt.id;
      f.receipt_number = receiptNumber;
      await this.feeRepo.save(f);
    }

    return {
      success: true,
      receiptNumber: savedReceipt.receipt_number,
      receiptId: savedReceipt.id,
      totalAmount: Number(savedReceipt.total_amount),
      paymentMethod: savedReceipt.payment_method,
      monthsCovered: savedReceipt.months_covered,
      paymentDate: savedReceipt.created_at,
      feeCount: fees.length,
    };
  }

  async getReceiptByNumber(receiptNumber: string, currentUser?: any) {
    const { isStudent, studentId: loggedInStudentId } = await this.getStudentScope(currentUser);

    let receipt = await this.feeReceiptRepo.findOne({
      where: { receipt_number: receiptNumber },
      relations: { student: { user: true, class: true }, fees: true },
    });

    if (!receipt) {
      const linkedFees = await this.feeRepo.find({
        where: { receipt_number: receiptNumber },
        relations: { student: { user: true, class: true } },
      });
      if (linkedFees.length > 0) {
        const first = linkedFees[0];
        if (isStudent && loggedInStudentId && first.student_id !== loggedInStudentId) {
          return null;
        }
        const monthsSet = new Set(linkedFees.map((f) => f.month).filter(Boolean));
        return {
          id: 0,
          receiptNumber: receiptNumber,
          studentId: String(first.student_id),
          studentName: first.student?.user ? first.student.user.name : "",
          rollNumber: first.student?.roll_no || "",
          class: first.student?.class ? `${first.student.class.name}-${first.student.class.division || ""}` : "",
          totalAmount: linkedFees.reduce((sum, f) => sum + Number(f.amount || 0), 0),
          paymentMethod: "cash",
          monthsCovered: Array.from(monthsSet).join(", "),
          paymentDate: first.paid_at || first.updated_at,
          fees: linkedFees.map((f) => this.mapFeeEntity(f)),
        };
      }
      return null;
    }

    if (isStudent && loggedInStudentId && receipt.student_id !== loggedInStudentId) {
      return null;
    }

    return {
      id: receipt.id,
      receiptNumber: receipt.receipt_number,
      studentId: String(receipt.student_id),
      studentName: receipt.student?.user ? receipt.student.user.name : "",
      rollNumber: receipt.student?.roll_no || "",
      class: receipt.student?.class ? `${receipt.student.class.name}-${receipt.student.class.division || ""}` : "",
      totalAmount: Number(receipt.total_amount),
      paymentMethod: receipt.payment_method,
      monthsCovered: receipt.months_covered,
      paymentDate: receipt.created_at,
      fees: (receipt.fees || []).map((f) => this.mapFeeEntity(f)),
    };
  }

  async generateFeeReceiptPdf(feeId: number, currentUser?: any): Promise<Buffer> {
    const { isStudent, studentId: loggedInStudentId } = await this.getStudentScope(currentUser);
    const fee = await this.getFullFeeRecord(feeId);
    if (!fee) throw new NotFoundException("Fee record not found");

    if (isStudent && loggedInStudentId && Number(fee.studentId) !== loggedInStudentId) {
      throw new NotFoundException("Fee record not found");
    }

    if (fee.receiptNumber) {
      return this.generateReceiptPdfByNumber(fee.receiptNumber, currentUser);
    }

    let feeItems = [fee];
    if (fee.studentId && fee.month) {
      const qb = this.feeRepo
        .createQueryBuilder("f")
        .innerJoinAndSelect("f.student", "st")
        .innerJoinAndSelect("st.user", "u")
        .leftJoinAndSelect("st.class", "c")
        .where("f.student_id = :studentId", { studentId: Number(fee.studentId) })
        .andWhere("f.month = :month", { month: fee.month });

      const list = await qb.getMany();
      if (list.length > 0) {
        feeItems = list.map((f) => this.mapFeeEntity(f));
      }
    }

    return this.buildPdfFromFeeItems(feeItems, fee.month);
  }

  async generateReceiptPdfByNumber(receiptNumber: string, currentUser?: any): Promise<Buffer> {
    const { isStudent, studentId: loggedInStudentId } = await this.getStudentScope(currentUser);
    const receipt = await this.feeReceiptRepo.findOne({
      where: { receipt_number: receiptNumber },
      relations: { student: { user: true, class: true }, fees: true },
    });

    if (receipt) {
      if (isStudent && loggedInStudentId && receipt.student_id !== loggedInStudentId) {
        throw new NotFoundException(`Receipt ${receiptNumber} not found`);
      }
      const feeItems = (receipt.fees || []).map((f) => ({
        ...this.mapFeeEntity(f),
        studentName: receipt.student?.user ? receipt.student.user.name : "",
        rollNumber: receipt.student ? receipt.student.roll_no : "",
        class: receipt.student?.class ? `${receipt.student.class.name}-${receipt.student.class.division || ""}` : "",
      }));
      return this.buildPdfFromFeeItems(
        feeItems.length > 0 ? feeItems : [{
          id: receipt.receipt_number,
          studentName: receipt.student?.user ? receipt.student.user.name : "",
          rollNumber: receipt.student ? receipt.student.roll_no : "",
          class: receipt.student?.class ? `${receipt.student.class.name}-${receipt.student.class.division || ""}` : "",
          amount: Number(receipt.total_amount),
          feeType: "tuition",
          month: receipt.months_covered,
          status: "paid",
          paidDate: receipt.created_at ? new Date(receipt.created_at).toISOString() : null,
        }],
        receipt.months_covered,
        receipt.receipt_number,
        receipt.payment_method
      );
    }

    const linkedFees = await this.feeRepo.find({
      where: { receipt_number: receiptNumber },
      relations: { student: { user: true, class: true } },
    });

    if (linkedFees.length > 0) {
      if (isStudent && loggedInStudentId && linkedFees[0].student_id !== loggedInStudentId) {
        throw new NotFoundException(`Receipt ${receiptNumber} not found`);
      }
      const feeItems = linkedFees.map((f) => this.mapFeeEntity(f));
      const monthsSet = new Set(linkedFees.map((f) => f.month).filter(Boolean));
      const monthsCovered = Array.from(monthsSet).join(", ");
      return this.buildPdfFromFeeItems(feeItems, monthsCovered, receiptNumber, "cash");
    }

    throw new NotFoundException(`Receipt ${receiptNumber} not found`);
  }

  async generateMonthlyFeeReceiptPdf(studentId: number, month: string, currentUser?: any): Promise<Buffer> {
    const { isStudent, studentId: loggedInStudentId } = await this.getStudentScope(currentUser);
    const effectiveStudentId = (isStudent && loggedInStudentId) ? loggedInStudentId : studentId;

    const qb = this.feeRepo
      .createQueryBuilder("f")
      .innerJoinAndSelect("f.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .where("f.student_id = :studentId", { studentId: effectiveStudentId })
      .andWhere("f.month = :month", { month });

    const list = await qb.getMany();
    if (list.length === 0) {
      throw new NotFoundException("No fee records found for this student and month");
    }

    const feeItems = list.map((f) => this.mapFeeEntity(f));
    return this.buildPdfFromFeeItems(feeItems, month);
  }

  private buildPdfFromFeeItems(
    feeItems: any[],
    targetMonth?: string,
    customReceiptNumber?: string,
    paymentMethod?: string
  ): Promise<Buffer> {
    const firstFee = feeItems[0] || {};
    const totalAmount = feeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allPaid = feeItems.every((item) => item.status === "paid");
    const anyPaid = feeItems.some((item) => item.status === "paid");
    const overallStatus = allPaid ? "PAID" : anyPaid ? "PARTIALLY PAID" : "PENDING";
    const displayReceiptNo = customReceiptNumber || firstFee.receiptNumber || `REC-${firstFee.id || "000"}`;
    const displayPaymentMode = (paymentMethod || "CASH").toUpperCase();

    const uniqueMonths = Array.from(new Set(feeItems.map((i) => i.month).filter(Boolean)));
    const monthsText = targetMonth || (uniqueMonths.length > 0 ? uniqueMonths.join(", ") : "N/A");

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#047857";
      const secondaryColor = "#475569";
      const darkColor = "#0f172a";

      // Header / Branding
      doc.rect(40, 40, 515, 60).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("SCHOOL MANAGEMENT SYSTEM", 55, 52);
      doc.fontSize(11).font("Helvetica").text("OFFICIAL MULTI-MONTH FEE PAYMENT RECEIPT", 55, 76);

      // Receipt Ref & Status
      doc.fillColor(darkColor).fontSize(10).font("Helvetica-Bold").text(`Receipt No: #${displayReceiptNo}`, 350, 52, { width: 190, align: "right" });
      doc.fontSize(9).font("Helvetica").text(`Payment Mode: ${displayPaymentMode}`, 350, 68, { width: 190, align: "right" });
      doc.text(`Status: ${overallStatus}`, 350, 82, { width: 190, align: "right" });

      // Student Info Box
      let y = 115;
      doc.rect(40, y, 515, 80).fillAndStroke("#f0fdf4", "#bbf7d0");

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("STUDENT & PAYMENT DETAILS", 55, y + 10);
      doc.fillColor(darkColor).fontSize(9.5).font("Helvetica-Bold").text("Student Name:", 55, y + 30);
      doc.font("Helvetica").text(firstFee.studentName || "N/A", 140, y + 30);
      doc.font("Helvetica-Bold").text("Class & Division:", 55, y + 48);
      doc.font("Helvetica").text(firstFee.class || "N/A", 140, y + 48);

      doc.font("Helvetica-Bold").text("Roll / Student ID:", 330, y + 30);
      doc.font("Helvetica").text(firstFee.rollNumber || firstFee.studentId || "N/A", 430, y + 30);
      doc.font("Helvetica-Bold").text("Months Paid:", 330, y + 48);
      doc.font("Helvetica-Bold").fillColor("#047857").text(monthsText, 430, y + 48, { width: 115 });

      // Fee Breakdown Table Header
      y = 210;
      doc.rect(40, y, 515, 25).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
      doc.text("MONTH", 55, y + 7);
      doc.text("FEE TYPE / HEAD", 150, y + 7);
      doc.text("REMARKS / NOTE", 300, y + 7);
      doc.text("AMOUNT (₹)", 440, y + 7, { width: 100, align: "right" });

      y = 235;
      feeItems.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 28).fillAndStroke(bg, "#e2e8f0");
        doc.fillColor(darkColor).fontSize(9).font("Helvetica-Bold").text(String(item.month || "N/A"), 55, y + 8);
        doc.fillColor(primaryColor).fontSize(9.5).font("Helvetica-Bold").text(String(item.feeType || "Fee Item").toUpperCase(), 150, y + 8);
        doc.fillColor(darkColor).font("Helvetica").fontSize(9).text(item.remarks || `${item.feeType} fee for ${item.month || "billing"}`, 300, y + 8, { width: 135 });
        doc.font("Helvetica-Bold").text(`₹${Number(item.amount || 0).toLocaleString()}`, 440, y + 8, { width: 100, align: "right" });
        y += 28;
      });

      // Total Box
      y += 15;
      doc.rect(40, y, 515, 45).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("TOTAL AMOUNT PAID:", 55, y + 15);
      doc.fillColor("#16a34a")
        .fontSize(16).font("Helvetica-Bold")
        .text(`₹${totalAmount.toLocaleString()}`, 390, y + 12, { width: 150, align: "right" });

      // Footer
      y += 65;
      doc.fillColor(secondaryColor).fontSize(8.5).font("Helvetica-Oblique").text("Thank you for your fee payment. This is an official computer-generated receipt for all selected months.", 40, y);

      y += 35;
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(380, y).lineTo(535, y).stroke();
      doc.fillColor(darkColor).fontSize(9).font("Helvetica-Bold").text("Authorized Cashier / Principal", 380, y + 5, { width: 155, align: "center" });

      doc.end();
    });
  }
}
