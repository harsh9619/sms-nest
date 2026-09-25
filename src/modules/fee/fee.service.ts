import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import PDFDocument from "pdfkit";
import { Fee } from "../../entities/fee.entity.js";
import { FeeReceipt } from "../../entities/fee-receipt.entity.js";
import { SchoolClassFeeStructure } from "../../entities/class-fee-structure.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";


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
    @Inject(AcademicYearService)
    private ayService: AcademicYearService,
  ) { }

  private mapFeeEntity(f: Fee) {
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
      status: f.status,
      remarks: f.description,
      schoolId: String(f.school_id),
      receiptId: f.receipt_id ? String(f.receipt_id) : undefined,
      receiptNumber: f.receipt_number || undefined,
    };
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
  }) {
    const { schoolId, academicYearHeader, page, limit, search, status, feeType, month, studentId } = params;

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
    if (studentId) {
      qb.andWhere("f.student_id = :studentId", { studentId });
    }
    if (status && status !== "all") {
      qb.andWhere("f.status = :status", { status });
    }
    if (feeType && feeType !== "all") {
      qb.andWhere("f.fee_type = :feeType", { feeType });
    }
    if (month && month !== "all") {
      qb.andWhere("f.month = :month", { month });
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE :q OR LOWER(st.roll_no) LIKE :q OR LOWER(c.name) LIKE :q OR LOWER(f.fee_type) LIKE :q OR LOWER(f.description) LIKE :q OR LOWER(f.month) LIKE :q)",
        { q }
      );
    }

    qb.orderBy("f.created_at", "DESC");

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

  async generateInvoicesFromClassStructure(schoolId: number, classMasterId: number, dueDate?: string, month?: string, academicYearHeader?: string) {
    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId);
    }
    const structures = await this.classFeeStructRepo.find({
      where: { school_id: schoolId, class_master_id: classMasterId },
    });

    if (structures.length === 0) {
      return { count: 0, message: "No class fee structures configured for this class level." };
    }

    // Find all students enrolled in classes matching classMasterId
    const schoolClasses = await this.schoolClassRepo.find({
      where: { school_id: schoolId, class_master_id: classMasterId },
    });

    const classIds = schoolClasses.map((sc) => sc.id);
    if (classIds.length === 0) {
      return { count: 0, message: "No active classes found for this grade level." };
    }

    const qb = this.studentRepo.createQueryBuilder("st").where("st.school_id = :schoolId", { schoolId });
    qb.andWhere("st.class_id IN (:...classIds)", { classIds });
    const students = await qb.getMany();

    let createdCount = 0;
    const targetDueDate = dueDate || new Date().toISOString().split("T")[0];
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Filter structures matching targetMonth or set to 'all'/recurring
    const applicableStructures = structures.filter((struct) => {
      if (!struct.month || struct.month === "all" || struct.month === "every_month") {
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

    if (applicableStructures.length === 0) {
      return { count: 0, message: `No fee components configured specifically for month ${targetMonth}.` };
    }

    for (const student of students) {
      for (const struct of applicableStructures) {
        const newFee = this.feeRepo.create({
          school_id: schoolId,
          school_academic_year_id: sayId,
          student_id: student.id,
          amount: struct.amount,
          fee_type: struct.fee_type,
          description: struct.fee_name,
          month: targetMonth,
          due_date: targetDueDate,
          status: "pending",
        });
        await this.feeRepo.save(newFee);
        createdCount++;
      }
    }

    return {
      count: createdCount,
      message: `Successfully generated ${createdCount} fee invoices for ${students.length} students.`,
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

  async getReceiptByNumber(receiptNumber: string) {
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

  async generateFeeReceiptPdf(feeId: number): Promise<Buffer> {
    const fee = await this.getFullFeeRecord(feeId);
    if (!fee) throw new NotFoundException("Fee record not found");

    if (fee.receiptNumber) {
      return this.generateReceiptPdfByNumber(fee.receiptNumber);
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

  async generateReceiptPdfByNumber(receiptNumber: string): Promise<Buffer> {
    const receipt = await this.feeReceiptRepo.findOne({
      where: { receipt_number: receiptNumber },
      relations: { student: { user: true, class: true }, fees: true },
    });

    if (receipt) {
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
      const feeItems = linkedFees.map((f) => this.mapFeeEntity(f));
      const monthsSet = new Set(linkedFees.map((f) => f.month).filter(Boolean));
      const monthsCovered = Array.from(monthsSet).join(", ");
      return this.buildPdfFromFeeItems(feeItems, monthsCovered, receiptNumber, "cash");
    }

    throw new NotFoundException(`Receipt ${receiptNumber} not found`);
  }

  async generateMonthlyFeeReceiptPdf(studentId: number, month: string): Promise<Buffer> {
    const qb = this.feeRepo
      .createQueryBuilder("f")
      .innerJoinAndSelect("f.student", "st")
      .innerJoinAndSelect("st.user", "u")
      .leftJoinAndSelect("st.class", "c")
      .where("f.student_id = :studentId", { studentId })
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
