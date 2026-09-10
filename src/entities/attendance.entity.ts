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
import { Class } from "./class.entity.js";
import { User } from "./user.entity.js";

export enum AttendanceStatus {
  PRESENT = "present",
  ABSENT = "absent",
  LATE = "late",
  EXCUSED = "excused",
}

@Entity("attendance")
export class Attendance {
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

  @Column({ type: "int", nullable: true })
  class_id: number;

  @ManyToOne(() => Class, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "class_id" })
  class: Class;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar", default: AttendanceStatus.PRESENT })
  status: string;

  @Column({ type: "int", nullable: true })
  marked_by: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "marked_by" })
  marker: User;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;
}
