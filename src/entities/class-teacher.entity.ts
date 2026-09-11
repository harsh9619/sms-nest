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
import { User } from "./user.entity.js";

@Entity("school_class_teachers")
export class SchoolClassTeacher {
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
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "boolean", default: true })
  is_primary: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}

export { SchoolClassTeacher as ClassTeacher };

