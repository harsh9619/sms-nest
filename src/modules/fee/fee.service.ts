import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import PDFDocument from "pdfkit";
import { Fee } from "../../entities/fee.entity.js";
import { SchoolClassFeeStructure } from "../../entities/class-fee-structure.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";


@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(Fee)
    private feeRepo: Repository<Fee>,
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

    return {
      id: String(feeObj.id),
      studentId: String(feeObj.student_id),
      studentName: feeObj.student?.user ? feeObj.student.user.name : "",
      rollNumber: feeObj.student ? feeObj.student.roll_no : "",
      class: feeObj.student?.class ? `${feeObj.student.class.name}-${feeObj.student.class.division || ""}` : "",
      amount: Number(feeObj.amount),
      type: feeObj.fee_type,
      feeType: feeObj.fee_type,
      month: feeObj.month || undefined,
      dueDate: feeObj.due_date,
      paidDate: feeObj.paid_at ? new Date(feeObj.paid_at).toISOString() : null,
      status: feeObj.status,
      remarks: feeObj.description,
      schoolId: String(feeObj.school_id),
    };
  }

  async createFee(schoolId: number, data: any) {
    const { studentId, amount, feeType, dueDate, month, paidDate, status, remarks } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "hostel", "lab", "annual", "computer", "uniforms", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : (feeType || "other");
    const description = remarks || (feeType !== dbFeeType ? feeType : null);

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId);
    }

    const newFee = this.feeRepo.create({
      school_id: schoolId,
      school_academic_year_id: sayId || undefined,
      student_id: studentId,
      amount,
      fee_type: dbFeeType,
      month: month || new Date().toISOString().slice(0, 7),
      description,
      due_date: dueDate || new Date().toISOString().split("T")[0],
      status: status || "pending",
      paid_at: paidDate ? new Date(paidDate) : null,
    });

    const saved = await this.feeRepo.save(newFee);
    return saved.id;
  }

  async updateFee(feeId: number, data: any) {
    const { amount, feeType, remarks, dueDate, month, status, paidDate } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "hostel", "lab", "annual", "computer", "uniforms", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : (feeType || "other");
    const description = remarks || (feeType !== dbFeeType ? feeType : null);

    await this.feeRepo.update(feeId, {
      amount,
      fee_type: dbFeeType,
      month,
      description,
      due_date: dueDate,
      status,
      paid_at: paidDate ? new Date(paidDate) : null,
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

  async generateFeeReceiptPdf(feeId: number): Promise<Buffer> {
    const fee = await this.getFullFeeRecord(feeId);
    if (!fee) throw new NotFoundException("Fee record not found");

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

  private buildPdfFromFeeItems(feeItems: any[], targetMonth?: string): Promise<Buffer> {
    const firstFee = feeItems[0];
    const totalAmount = feeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allPaid = feeItems.every((item) => item.status === "paid");
    const anyPaid = feeItems.some((item) => item.status === "paid");
    const overallStatus = allPaid ? "PAID" : anyPaid ? "PARTIALLY PAID" : "PENDING";

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
      doc.fontSize(11).font("Helvetica").text("OFFICIAL CONSOLIDATED MONTHLY FEE RECEIPT", 55, 76);

      // Receipt Ref & Status
      doc.fillColor(darkColor).fontSize(10).font("Helvetica-Bold").text(`Receipt No: #REC-${firstFee.id}`, 400, 52, { align: "right" });
      doc.fontSize(9).font("Helvetica").text(`Due Date: ${firstFee.dueDate ? new Date(firstFee.dueDate).toLocaleDateString() : "N/A"}`, 400, 68, { align: "right" });
      doc.text(`Status: ${overallStatus}`, 400, 82, { align: "right" });

      // Student Info Box
      let y = 120;
      doc.rect(40, y, 515, 75).fillAndStroke("#f0fdf4", "#bbf7d0");

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("STUDENT INFORMATION", 55, y + 10);
      doc.fillColor(darkColor).fontSize(9.5).font("Helvetica-Bold").text("Student Name:", 55, y + 30);
      doc.font("Helvetica").text(firstFee.studentName || "N/A", 140, y + 30);
      doc.font("Helvetica-Bold").text("Class & Division:", 55, y + 48);
      doc.font("Helvetica").text(firstFee.class || "N/A", 140, y + 48);

      doc.font("Helvetica-Bold").text("Roll / Student ID:", 330, y + 30);
      doc.font("Helvetica").text(firstFee.rollNumber || firstFee.studentId || "N/A", 430, y + 30);
      doc.font("Helvetica-Bold").text("Billing Period / Month:", 330, y + 48);
      doc.font("Helvetica").text(targetMonth || firstFee.month || "N/A", 430, y + 48);

      // Fee Breakdown Table Header
      y = 215;
      doc.rect(40, y, 515, 25).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
      doc.text("FEE TYPE / HEAD", 55, y + 7);
      doc.text("REMARKS / NOTE", 230, y + 7);
      doc.text("AMOUNT (₹)", 440, y + 7, { width: 100, align: "right" });

      y = 240;
      feeItems.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 28).fillAndStroke(bg, "#e2e8f0");
        doc.fillColor(darkColor).fontSize(9.5).font("Helvetica-Bold").text(String(item.feeType || "Fee Item").toUpperCase(), 55, y + 8);
        doc.font("Helvetica").fontSize(9).text(item.remarks || `${item.feeType} billing for ${targetMonth || "month"}`, 230, y + 8, { width: 200 });
        doc.font("Helvetica-Bold").text(`₹${Number(item.amount || 0).toLocaleString()}`, 440, y + 8, { width: 100, align: "right" });
        y += 28;
      });

      // Total Box
      y += 15;
      doc.rect(40, y, 515, 45).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("TOTAL MONTHLY AMOUNT PAID / DUE:", 55, y + 15);
      doc.fillColor(allPaid ? "#16a34a" : "#d97706")
        .fontSize(15).font("Helvetica-Bold")
        .text(`₹${totalAmount.toLocaleString()}`, 390, y + 13, { width: 150, align: "right" });

      // Footer
      y += 65;
      doc.fillColor(secondaryColor).fontSize(8.5).font("Helvetica-Oblique").text("Thank you for your fee payment. Official computer generated fee receipt.", 40, y);

      y += 35;
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(380, y).lineTo(535, y).stroke();
      doc.fillColor(darkColor).fontSize(9).font("Helvetica-Bold").text("Authorized Cashier / Principal", 380, y + 5, { width: 155, align: "center" });

      doc.end();
    });
  }
}
