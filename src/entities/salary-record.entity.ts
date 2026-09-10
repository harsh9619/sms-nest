import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { School } from "./school.entity.js";
import { SchoolAcademicYear } from "./school-academic-year.entity.js";
import { User } from "./user.entity.js";
import { SalaryStructure } from "./salary-structure.entity.js";

@Entity("salary_records")
export class SalaryRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int", nullable: true })
  school_academic_year_id: number;

  @ManyToOne(() => SchoolAcademicYear, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "school_academic_year_id" })
  school_academic_year: SchoolAcademicYear;

  @Column({ type: "int" })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "int", nullable: true })
  salary_structure_id: number;

  @ManyToOne(() => SalaryStructure, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "salary_structure_id" })
  salary_structure: SalaryStructure;

  @Column({ type: "int" })
  month: number;

  @Column({ type: "int" })
  year: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  basic_salary: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  other_allowances: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  other_deductions: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  gross_salary: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  total_deductions: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  net_salary: number;

  @Column({ type: "varchar", default: "pending" })
  status: string;

  @Column({ type: "timestamptz", nullable: true })
  paid_at: Date;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
