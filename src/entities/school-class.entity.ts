import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { School } from "./school.entity.js";
import { SchoolAcademicYear } from "./school-academic-year.entity.js";
import { ClassMaster } from "./class-master.entity.js";
import { DivisionMaster } from "./division-master.entity.js";
import type { SchoolClassTeacher } from "./class-teacher.entity.js";

@Entity("school_classes")
export class SchoolClass {
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

  @Column({ type: "int", nullable: true })
  class_master_id: number;

  @ManyToOne(() => ClassMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "class_master_id" })
  class_master: ClassMaster;

  @Column({ type: "int", nullable: true })
  division_master_id: number;

  @ManyToOne(() => DivisionMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "division_master_id" })
  division_master: DivisionMaster;

  @Column({ type: "varchar", length: 50 })
  name: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  division: string;

  get section(): string {
    return this.division;
  }

  @OneToMany("SchoolClassTeacher", "class")
  class_teachers: SchoolClassTeacher[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}

