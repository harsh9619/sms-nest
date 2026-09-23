import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Fee } from "../../entities/fee.entity.js";
import { SchoolClassFeeStructure } from "../../entities/class-fee-structure.entity.js";
import { Student } from "../../entities/student.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";

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
    private schoolClassRepo: Repository<SchoolClass>
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
      class: f.student?.class ? `${f.student.class.name}-${f.student.class.division || ""}` : "",
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

  async generateInvoicesFromClassStructure(schoolId: number, classMasterId: number, dueDate?: string) {
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
}
