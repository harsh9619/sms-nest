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

@Entity("school_working_days")
export class SchoolWorkingDay {
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

  @Column({ type: "date", nullable: true })
  session_start_date: string;

  @Column({ type: "date", nullable: true })
  session_end_date: string;

  @Column({ type: "jsonb", default: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] })
  working_days: string[];

  @Column({ type: "int", default: 8 })
  periods_per_day: number;

  @Column({ type: "varchar", length: 10, default: "08:30" })
  school_start_time: string;

  @Column({ type: "varchar", length: 10, default: "14:30" })
  school_end_time: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
