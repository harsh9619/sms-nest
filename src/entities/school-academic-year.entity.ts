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
import { AcademicYear } from "./academic-year.entity.js";

@Entity("school_academic_years")
export class SchoolAcademicYear {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int" })
  academic_year_id: number;

  @ManyToOne(() => AcademicYear, { onDelete: "CASCADE" })
  @JoinColumn({ name: "academic_year_id" })
  academic_year: AcademicYear;

  @Column({ type: "boolean", default: false })
  is_current: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
