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
import { User } from "./user.entity.js";

@Entity("classes")
export class Class {
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

  @Column({ type: "varchar", length: 50 })
  name: string;

  @Column({ type: "varchar", length: 10 })
  section: string;

  @Column({ type: "int", nullable: true })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
