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
    studentId?: number;
  }) {
    const { schoolId, academicYearHeader, page, limit, search, status, feeType, studentId } = params;

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
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE :q OR LOWER(st.roll_no) LIKE :q OR LOWER(c.name) LIKE :q OR LOWER(f.fee_type) LIKE :q OR LOWER(f.description) LIKE :q)",
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
      dueDate: feeObj.due_date,
      paidDate: feeObj.paid_at ? new Date(feeObj.paid_at).toISOString() : null,
      status: feeObj.status,
      remarks: feeObj.description,
      schoolId: String(feeObj.school_id),
    };
  }

  async createFee(schoolId: number, data: any) {
    const { studentId, amount, feeType, dueDate, paidDate, status, remarks } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : "other";
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
      description,
      due_date: dueDate || new Date().toISOString().split("T")[0],
      status: status || "pending",
      paid_at: paidDate ? new Date(paidDate) : null,
    });

    const saved = await this.feeRepo.save(newFee);
    return saved.id;
  }

  async updateFee(feeId: number, data: any) {
    const { amount, feeType, remarks, dueDate, status, paidDate } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : "other";
    const description = remarks || (feeType !== dbFeeType ? feeType : null);

    await this.feeRepo.update(feeId, {
      amount,
      fee_type: dbFeeType,
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
      isMandatory: item.is_mandatory,
      description: item.description,
    }));
  }

  async createOrUpdateClassFeeStructure(schoolId: number, data: any) {
    const { id, classMasterId, feeType, feeName, amount, frequency, dueDay, isMandatory, description } = data;

    if (id) {
      await this.classFeeStructRepo.update(id, {
        class_master_id: classMasterId,
        fee_type: feeType || "tuition",
        fee_name: feeName,
        amount: amount || 0,
        frequency: frequency || "monthly",
        due_day: dueDay || 10,
        is_mandatory: isMandatory !== undefined ? isMandatory : true,
        description,
      });
      return id;
    }

    const newStruct = this.classFeeStructRepo.create({
      school_id: schoolId,
      class_master_id: classMasterId,
      fee_type: feeType || "tuition",
      fee_name: feeName,
      amount: amount || 0,
      frequency: frequency || "monthly",
      due_day: dueDay || 10,
      is_mandatory: isMandatory !== undefined ? isMandatory : true,
      description,
    });

    const saved = await this.classFeeStructRepo.save(newStruct);
    return saved.id;
  }

  async deleteClassFeeStructure(id: number) {
    await this.classFeeStructRepo.delete(id);
  }

  async generateInvoicesFromClassStructure(schoolId: number, classMasterId: number, dueDate?: string, academicYearHeader?: string) {
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

    for (const student of students) {
      for (const struct of structures) {
        const newFee = this.feeRepo.create({
          school_id: schoolId,
          school_academic_year_id: sayId,
          student_id: student.id,
          amount: struct.amount,
          fee_type: struct.fee_type,
          description: struct.fee_name,
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
      doc.fontSize(11).font("Helvetica").text("OFFICIAL FEE PAYMENT RECEIPT", 55, 76);

      // Receipt Ref & Status
      doc.fillColor(darkColor).fontSize(10).font("Helvetica-Bold").text(`Receipt No: #REC-${fee.id}`, 400, 52, { align: "right" });
      doc.fontSize(9).font("Helvetica").text(`Due Date: ${fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "N/A"}`, 400, 68, { align: "right" });
      doc.text(`Status: ${(fee.status || "pending").toUpperCase()}`, 400, 82, { align: "right" });

      // Student Info Box
      let y = 120;
      doc.rect(40, y, 515, 75).fillAndStroke("#f0fdf4", "#bbf7d0");

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("STUDENT INFORMATION", 55, y + 10);
      doc.fillColor(darkColor).fontSize(9.5).font("Helvetica-Bold").text("Student Name:", 55, y + 30);
      doc.font("Helvetica").text(fee.studentName || "N/A", 140, y + 30);
      doc.font("Helvetica-Bold").text("Class & Division:", 55, y + 48);
      doc.font("Helvetica").text(fee.class || "N/A", 140, y + 48);

      doc.font("Helvetica-Bold").text("Roll / Student ID:", 330, y + 30);
      doc.font("Helvetica").text(fee.rollNumber || fee.studentId || "N/A", 430, y + 30);
      doc.font("Helvetica-Bold").text("Payment Date:", 330, y + 48);
      doc.font("Helvetica").text(fee.paidDate ? new Date(fee.paidDate).toLocaleDateString() : "Pending Payment", 430, y + 48);

      // Fee Breakdown Table
      y = 215;
      doc.rect(40, y, 515, 25).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
      doc.text("FEE TYPE / HEAD", 55, y + 7);
      doc.text("REMARKS / NOTE", 230, y + 7);
      doc.text("AMOUNT (₹)", 440, y + 7, { width: 100, align: "right" });

      y = 240;
      doc.rect(40, y, 515, 30).fillAndStroke("#ffffff", "#f1f5f9");
      doc.fillColor(darkColor).fontSize(9.5).font("Helvetica-Bold").text((fee.type || fee.feeType || "Tuition Fee").toUpperCase(), 55, y + 9);
      doc.font("Helvetica").fontSize(9).text(fee.remarks || "Standard Academic Fee Invoice", 230, y + 9, { width: 200 });
      doc.font("Helvetica-Bold").text(`₹${Number(fee.amount || 0).toLocaleString()}`, 440, y + 9, { width: 100, align: "right" });

      // Total Box
      y += 45;
      doc.rect(40, y, 515, 45).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("TOTAL AMOUNT PAID / DUE:", 55, y + 15);
      doc.fillColor(fee.status === "paid" ? "#16a34a" : "#d97706")
        .fontSize(15).font("Helvetica-Bold")
        .text(`₹${Number(fee.amount || 0).toLocaleString()}`, 410, y + 13, { width: 130, align: "right" });

      // Footer
      y += 75;
      doc.fillColor(secondaryColor).fontSize(8.5).font("Helvetica-Oblique").text("Thank you for your fee payment. Official computer generated fee receipt.", 40, y);

      y += 40;
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(380, y).lineTo(535, y).stroke();
      doc.fillColor(darkColor).fontSize(9).font("Helvetica-Bold").text("Authorized Cashier / Principal", 380, y + 5, { width: 155, align: "center" });

      doc.end();
    });
  }
}
