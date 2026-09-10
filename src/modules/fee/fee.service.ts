import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Fee } from "../../entities/fee.entity.js";

@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(Fee)
    private feeRepo: Repository<Fee>
  ) {}

  async getFees(schoolId?: number, academicYear?: string) {
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
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }

    qb.orderBy("f.created_at", "DESC");

    const fees = await qb.getMany();
    return fees.map((f) => ({
      id: String(f.id),
      studentId: String(f.student_id),
      studentName: f.student?.user ? f.student.user.name : "",
      rollNumber: f.student ? f.student.roll_no : "",
      class: f.student?.class ? `${f.student.class.name}-${f.student.class.section}` : "",
      amount: Number(f.amount),
      type: f.fee_type,
      feeType: f.fee_type,
      dueDate: f.due_date,
      paidDate: f.paid_at ? new Date(f.paid_at).toISOString() : null,
      status: f.status,
      remarks: f.description,
      schoolId: String(f.school_id),
    }));
  }

  async getFeeById(feeId: number) {
    return this.feeRepo.findOne({ where: { id: feeId } });
  }

  async getFullFeeRecord(feeId: number) {
    const fees = await this.getFees(undefined, undefined);
    return fees.find((f) => Number(f.id) === feeId) || null;
  }

  async createFee(schoolId: number, data: any) {
    const { studentId, amount, feeType, dueDate, paidDate, status, remarks } = data;

    const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "other"];
    const dbFeeType = validFeeTypes.includes(feeType) ? feeType : "other";
    const description = remarks || (feeType !== dbFeeType ? feeType : null);

    const newFee = this.feeRepo.create({
      school_id: schoolId,
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
}
