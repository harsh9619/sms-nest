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
import { Class } from "./class.entity.js";
import { Subject } from "./subject.entity.js";
import { User } from "./user.entity.js";

@Entity("homework")
export class Homework {
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

  @ManyToOne(() => Class, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class: Class;

  @Column({ type: "int" })
  subject_id: number;

  @ManyToOne(() => Subject, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: Subject;

  @Column({ type: "int", nullable: true })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "date", nullable: true })
  due_date: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
