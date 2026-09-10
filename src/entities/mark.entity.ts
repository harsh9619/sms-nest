import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { School } from "./school.entity.js";
import { SchoolAcademicYear } from "./school-academic-year.entity.js";
import { Student } from "./student.entity.js";
import { Subject } from "./subject.entity.js";

@Entity("marks")
export class Mark {
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
  student_id: number;

  @ManyToOne(() => Student, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student: Student;

  @Column({ type: "int" })
  subject_id: number;

  @ManyToOne(() => Subject, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: Subject;

  @Column({ type: "varchar", default: "final" })
  exam_type: string;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  score: number;

  @Column({ type: "numeric", precision: 6, scale: 2, default: 100 })
  max_score: number;

  @Column({ type: "date", nullable: true })
  exam_date: string;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;
}
