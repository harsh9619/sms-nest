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

@Entity("fee_payment_schedules")
export class FeePaymentSchedule {
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

  @Column({ type: "varchar", length: 20, nullable: true })
  academic_year: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  schedule_name: string;

  /**
   * Session start: 'april' (April to March) or 'july' (July to June)
   */
  @Column({ type: "varchar", length: 20, default: "april" })
  session_start: string;

  /**
   * Frequency: 'monthly' (12 installments) or 'quarterly' (4 installments) or 'half_yearly' or 'annually'
   */
  @Column({ type: "varchar", length: 20, default: "monthly" })
  installment_format: string;

  @Column({ type: "int", default: 1 })
  order_seq: number;

  /**
   * Human readable title: "April 2024", "Q1 (April - June)", etc.
   */
  @Column({ type: "varchar", length: 100 })
  month_payable: string;

  /**
   * Months covered as comma-separated digits: e.g. "04" or "04,05,06"
   */
  @Column({ type: "varchar", length: 100, nullable: true })
  fee_for_months: string;

  /**
   * Multiplier: 1 for monthly, 3 for quarterly, 6 for half-yearly, 12 for annual
   */
  @Column({ type: "int", default: 1 })
  month_multiplier: number;

  /**
   * Day of month payment is due (e.g. 10th)
   */
  @Column({ type: "int", default: 10 })
  due_day: number;

  /**
   * Specific due date (optional override: YYYY-MM-DD)
   */
  @Column({ type: "date", nullable: true })
  due_date: string;

  /**
   * Grace period days before penalty
   */
  @Column({ type: "int", default: 5 })
  extension_days: number;

  /**
   * Cutoff day after which late fee is imposed
   */
  @Column({ type: "int", default: 15 })
  late_fee_day: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  late_fee_amount: number;

  @Column({ type: "varchar", length: 255, default: "cash,card,online,cheque,upi" })
  payment_methods_allowed: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
