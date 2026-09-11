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
import { SubjectMaster } from "./subject-master.entity.js";
import { User } from "./user.entity.js";
import { SchoolClass as Class } from "./school-class.entity.js";

@Entity("timetables")
export class Timetable {
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

  @Column({ type: "int", nullable: true })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "varchar", length: 20 })
  day_of_week: string;

  @Column({ type: "time" })
  start_time: string;

  @Column({ type: "time" })
  end_time: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  classroom: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
