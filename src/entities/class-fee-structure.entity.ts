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
import { ClassMaster } from "./class-master.entity.js";

@Entity("school_class_fee_structures")
export class SchoolClassFeeStructure {
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
  class_master_id: number;

  @ManyToOne(() => ClassMaster, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_master_id" })
  class_master: ClassMaster;

  @Column({ type: "varchar", default: "tuition" })
  fee_type: string;

  @Column({ type: "varchar", length: 100 })
  fee_name: string;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: "varchar", length: 20, default: "monthly" })
  frequency: string;

  @Column({ type: "int", default: 10 })
  due_day: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  month: string;

  @Column({ type: "boolean", default: true })
  is_mandatory: boolean;

  @Column({ type: "text", nullable: true })
  description: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
