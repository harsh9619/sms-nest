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
import { SchoolClass } from "./school-class.entity.js";
import { DivisionMaster } from "./division-master.entity.js";
import { SubjectMaster } from "./subject-master.entity.js";

@Entity("school_class_subjects")
export class SchoolClassSubject {
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
  class_id: number;

  @ManyToOne(() => SchoolClass, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class: SchoolClass;

  @Column({ type: "int", nullable: true })
  division_master_id: number;

  @ManyToOne(() => DivisionMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "division_master_id" })
  division_master: DivisionMaster;

  @Column({ type: "int" })
  subject_master_id: number;

  @ManyToOne(() => SubjectMaster, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_master_id" })
  subject_master: SubjectMaster;

  get subject(): SubjectMaster {
    return this.subject_master;
  }

  get subject_id(): number {
    return this.subject_master_id;
  }

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}

export { SchoolClassSubject as ClassSubject };

