import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalaryRecord } from "../../entities/salary-record.entity.js";

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalaryRecord)
    private salaryRepo: Repository<SalaryRecord>
  ) {}

  async getSalaries(schoolId?: number, academicYear?: string) {
    const qb = this.salaryRepo
      .createQueryBuilder("sr")
      .innerJoinAndSelect("sr.teacher", "u")
      .leftJoinAndSelect("sr.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("sr.school_id = :schoolId", { schoolId });
    }
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }

    qb.orderBy("sr.created_at", "DESC");

    const records = await qb.getMany();
    return records.map((sr) => ({
      id: String(sr.id),
      teacherId: String(sr.teacher_id),
      teacherName: sr.teacher ? sr.teacher.name : "",
      designation: "Teacher",
      month: sr.month,
      year: sr.year,
      baseSalary: Number(sr.basic_salary),
      allowances: Number(sr.other_allowances),
      deductions: Number(sr.other_deductions),
      netSalary: Number(sr.net_salary),
      status: sr.status,
      paidDate: sr.paid_at ? new Date(sr.paid_at).toISOString() : null,
      schoolId: String(sr.school_id),
    }));
  }

  async getSalaryById(recordId: number) {
    return this.salaryRepo.findOne({ where: { id: recordId } });
  }

  async getFullSalaryRecord(recordId: number) {
    const list = await this.getSalaries(undefined, undefined);
    return list.find((s) => Number(s.id) === recordId) || null;
  }

  async createSalary(schoolId: number, data: any) {
    const { teacherId, baseSalary, allowances, deductions, month, year, status, paidDate } = data;

    const dbBaseSalary = baseSalary || 0;
    const dbAllowances = allowances || 0;
    const dbDeductions = deductions || 0;
    const grossSalary = dbBaseSalary + dbAllowances;
    const netSalary = grossSalary - dbDeductions;

    const validStatuses = ["pending", "approved", "paid", "on_hold"];
    const dbStatus = validStatuses.includes(status) ? status : "pending";

    const newRecord = this.salaryRepo.create({
      school_id: schoolId,
      teacher_id: teacherId,
      month,
      year,
      basic_salary: dbBaseSalary,
      other_allowances: dbAllowances,
      other_deductions: dbDeductions,
      gross_salary: grossSalary,
      total_deductions: dbDeductions,
      net_salary: netSalary,
      status: dbStatus,
      paid_at: paidDate ? new Date(paidDate) : null,
    });

    const saved = await this.salaryRepo.save(newRecord);
    return saved.id;
  }

  async updateSalary(recordId: number, data: any) {
    const { baseSalary, allowances, deductions, month, year, status, paidDate } = data;

    const grossSalary = baseSalary + allowances;
    const netSalary = grossSalary - deductions;

    const validStatuses = ["pending", "approved", "paid", "on_hold"];
    const dbStatus = validStatuses.includes(status) ? status : "pending";

    await this.salaryRepo.update(recordId, {
      basic_salary: baseSalary,
      other_allowances: allowances,
      other_deductions: deductions,
      gross_salary: grossSalary,
      total_deductions: deductions,
      net_salary: netSalary,
      month,
      year,
      status: dbStatus,
      paid_at: paidDate ? new Date(paidDate) : null,
    });
  }

  async deleteSalary(recordId: number) {
    await this.salaryRepo.delete(recordId);
  }
}
