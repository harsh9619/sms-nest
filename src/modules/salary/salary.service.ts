import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalaryRecord } from "../../entities/salary-record.entity.js";
import { SalaryStructure } from "../../entities/salary-structure.entity.js";
import { User } from "../../entities/user.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseMonthToInt(monthInput: any): number {
  if (typeof monthInput === "number" && !isNaN(monthInput)) {
    if (monthInput >= 1 && monthInput <= 12) return monthInput;
  }
  if (monthInput !== null && monthInput !== undefined) {
    const s = String(monthInput).trim();
    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      if (num >= 1 && num <= 12) return num;
    }
    const idx = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === s.toLowerCase() || m.slice(0, 3).toLowerCase() === s.toLowerCase()
    );
    if (idx !== -1) return idx + 1;
  }
  return new Date().getMonth() + 1;
}

function formatMonth(monthVal: any): string {
  if (typeof monthVal === "number" && monthVal >= 1 && monthVal <= 12) {
    return MONTH_NAMES[monthVal - 1];
  }
  if (typeof monthVal === "string" && monthVal.trim()) {
    const parsed = parseMonthToInt(monthVal);
    return MONTH_NAMES[parsed - 1];
  }
  return MONTH_NAMES[new Date().getMonth()];
}

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalaryRecord)
    private salaryRepo: Repository<SalaryRecord>,
    @InjectRepository(SalaryStructure)
    private salaryStructRepo: Repository<SalaryStructure>,
    @Inject(AcademicYearService)
    private ayService: AcademicYearService,
  ) {}

  private mapSalaryRecord(sr: SalaryRecord) {
    return {
      id: String(sr.id),
      teacherId: String(sr.teacher_id),
      teacherName: sr.teacher ? sr.teacher.name : "",
      teacherEmail: sr.teacher ? sr.teacher.email : "",
      teacherPhone: sr.teacher ? sr.teacher.phone : "",
      designation: "Faculty Member",
      month: formatMonth(sr.month),
      year: sr.year,
      baseSalary: Number(sr.basic_salary),
      allowances: Number(sr.other_allowances),
      deductions: Number(sr.other_deductions),
      netSalary: Number(sr.net_salary),
      status: sr.status,
      paidDate: sr.paid_at ? new Date(sr.paid_at).toISOString() : null,
      schoolId: String(sr.school_id),
      schoolAcademicYearId: sr.school_academic_year_id ? String(sr.school_academic_year_id) : null,
    };
  }

  async getSalaries(params?: {
    schoolId?: number;
    academicYearHeader?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    teacherId?: number;
  }) {
    const { schoolId, academicYearHeader, academicYear, page, limit, search, status, teacherId } = params || {};

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    const qb = this.salaryRepo
      .createQueryBuilder("sr")
      .innerJoinAndSelect("sr.teacher", "u")
      .leftJoinAndSelect("sr.school_academic_year", "say")
      .leftJoinAndSelect("say.academic_year", "ay");

    if (schoolId) {
      qb.andWhere("sr.school_id = :schoolId", { schoolId });
    }
    if (sayId) {
      qb.andWhere("say.id = :sayId", { sayId });
    }
    if (academicYear) {
      qb.andWhere("ay.label = :academicYear", { academicYear });
    }
    if (teacherId) {
      qb.andWhere("sr.teacher_id = :teacherId", { teacherId });
    }
    if (status && status !== "all") {
      qb.andWhere("sr.status = :status", { status });
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE :q OR LOWER(sr.status) LIKE :q OR LOWER(sr.remarks) LIKE :q)",
        { q }
      );
    }

    qb.orderBy("sr.created_at", "DESC");

    if (page || limit) {
      const pageNum = Math.max(1, page || 1);
      const limitNum = Math.max(1, limit || 10);
      const skip = (pageNum - 1) * limitNum;

      qb.skip(skip).take(limitNum);
      const [records, total] = await qb.getManyAndCount();
      const data = records.map((sr) => this.mapSalaryRecord(sr));

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

    const records = await qb.getMany();
    return records.map((sr) => this.mapSalaryRecord(sr));
  }

  async getSalaryById(recordId: number) {
    return this.salaryRepo.findOne({ where: { id: recordId } });
  }

  async getFullSalaryRecord(recordId: number) {
    const sr = await this.salaryRepo.findOne({
      where: { id: recordId },
      relations: { teacher: true, school_academic_year: true },
    });
    if (!sr) return null;
    return this.mapSalaryRecord(sr);
  }

  async createSalary(schoolId: number, data: any) {
    const { teacherId, baseSalary, allowances, deductions, month, year, status, paidDate } = data;

    const dbBaseSalary = Number(baseSalary || 0);
    const dbAllowances = Number(allowances || 0);
    const dbDeductions = Number(deductions || 0);
    const grossSalary = dbBaseSalary + dbAllowances;
    const netSalary = grossSalary - dbDeductions;

    const validStatuses = ["pending", "approved", "paid", "on_hold"];
    const dbStatus = validStatuses.includes(status) ? status : "pending";

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId);
    }

    const newRecord = this.salaryRepo.create({
      school_id: schoolId,
      school_academic_year_id: sayId || undefined,
      teacher_id: teacherId,
      month: parseMonthToInt(month),
      year: Number(year || new Date().getFullYear()),
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

    const dbBaseSalary = Number(baseSalary || 0);
    const dbAllowances = Number(allowances || 0);
    const dbDeductions = Number(deductions || 0);
    const grossSalary = dbBaseSalary + dbAllowances;
    const netSalary = grossSalary - dbDeductions;

    const validStatuses = ["pending", "approved", "paid", "on_hold"];
    const dbStatus = validStatuses.includes(status) ? status : "pending";

    await this.salaryRepo.update(recordId, {
      basic_salary: dbBaseSalary,
      other_allowances: dbAllowances,
      other_deductions: dbDeductions,
      gross_salary: grossSalary,
      total_deductions: dbDeductions,
      net_salary: netSalary,
      month: parseMonthToInt(month),
      year: Number(year || new Date().getFullYear()),
      status: dbStatus,
      paid_at: paidDate ? new Date(paidDate) : null,
    });
  }

  async deleteSalary(recordId: number) {
    await this.salaryRepo.delete(recordId);
  }

  // --- Staff Salary Structure Methods ---

  async getSalaryStructures(schoolId?: number, teacherId?: number) {
    const qb = this.salaryStructRepo
      .createQueryBuilder("ss")
      .innerJoinAndSelect("ss.teacher", "u");

    if (schoolId) {
      qb.andWhere("ss.school_id = :schoolId", { schoolId });
    }
    if (teacherId) {
      qb.andWhere("ss.teacher_id = :teacherId", { teacherId });
    }

    qb.orderBy("u.name", "ASC");

    const list = await qb.getMany();
    return list.map((ss) => ({
      id: String(ss.id),
      schoolId: String(ss.school_id),
      teacherId: String(ss.teacher_id),
      teacherName: ss.teacher ? ss.teacher.name : "",
      email: ss.teacher ? ss.teacher.email : "",
      phone: ss.teacher ? ss.teacher.phone : "",
      basicSalary: Number(ss.basic_salary),
      hra: Number(ss.hra),
      da: Number(ss.da),
      otherAllowance: Number(ss.other_allowance),
      pfDeduction: Number(ss.pf_deduction),
      taxDeduction: Number(ss.tax_deduction),
      grossSalary: Number(ss.basic_salary) + Number(ss.hra) + Number(ss.da) + Number(ss.other_allowance),
      netSalary:
        Number(ss.basic_salary) +
        Number(ss.hra) +
        Number(ss.da) +
        Number(ss.other_allowance) -
        (Number(ss.pf_deduction) + Number(ss.tax_deduction)),
      effectiveFrom: ss.effective_from,
      isActive: ss.is_active,
    }));
  }

  async createOrUpdateSalaryStructure(schoolId: number, data: any) {
    const {
      id,
      teacherId,
      basicSalary,
      hra,
      da,
      otherAllowance,
      pfDeduction,
      taxDeduction,
      effectiveFrom,
      isActive,
    } = data;

    if (id) {
      await this.salaryStructRepo.update(id, {
        teacher_id: teacherId,
        basic_salary: Number(basicSalary || 0),
        hra: Number(hra || 0),
        da: Number(da || 0),
        other_allowance: Number(otherAllowance || 0),
        pf_deduction: Number(pfDeduction || 0),
        tax_deduction: Number(taxDeduction || 0),
        effective_from: effectiveFrom || new Date().toISOString().split("T")[0],
        is_active: isActive !== undefined ? isActive : true,
      });
      return id;
    }

    const newStruct = this.salaryStructRepo.create({
      school_id: schoolId,
      teacher_id: teacherId,
      basic_salary: Number(basicSalary || 0),
      hra: Number(hra || 0),
      da: Number(da || 0),
      other_allowance: Number(otherAllowance || 0),
      pf_deduction: Number(pfDeduction || 0),
      tax_deduction: Number(taxDeduction || 0),
      effective_from: effectiveFrom || new Date().toISOString().split("T")[0],
      is_active: isActive !== undefined ? isActive : true,
    });

    const saved = await this.salaryStructRepo.save(newStruct);
    return saved.id;
  }

  async deleteSalaryStructure(id: number) {
    await this.salaryStructRepo.delete(id);
  }

  async generateMonthlyPayroll(schoolId: number, month: number, year: number) {
    const structures = await this.salaryStructRepo
      .createQueryBuilder("ss")
      .innerJoinAndSelect("ss.teacher", "u")
      .where("ss.school_id = :schoolId", { schoolId })
      .andWhere("ss.is_active = true")
      .getMany();

    if (structures.length === 0) {
      return { count: 0, message: "No active staff salary structures configured." };
    }

    let sayId: number | null = null;
    if (schoolId) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId);
    }

    let createdCount = 0;

    for (const struct of structures) {
      const basicSalary = Number(struct.basic_salary || 0);
      const allowances = Number(struct.hra || 0) + Number(struct.da || 0) + Number(struct.other_allowance || 0);
      const deductions = Number(struct.pf_deduction || 0) + Number(struct.tax_deduction || 0);
      const grossSalary = basicSalary + allowances;
      const netSalary = grossSalary - deductions;

      // Check if record already exists for month/year
      const existing = await this.salaryRepo.findOne({
        where: {
          school_id: schoolId,
          teacher_id: struct.teacher_id,
          month,
          year,
        },
      });

      if (!existing) {
        const newRecord = this.salaryRepo.create({
          school_id: schoolId,
          school_academic_year_id: sayId || undefined,
          teacher_id: struct.teacher_id,
          salary_structure_id: struct.id,
          month,
          year,
          basic_salary: basicSalary,
          other_allowances: allowances,
          other_deductions: deductions,
          gross_salary: grossSalary,
          total_deductions: deductions,
          net_salary: netSalary,
          status: "pending",
        });
        await this.salaryRepo.save(newRecord);
        createdCount++;
      }
    }

    return {
      count: createdCount,
      message: `Generated monthly payroll for ${createdCount} staff members for ${month}/${year}.`,
    };
  }
}
