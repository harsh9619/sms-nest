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
import { User } from "./user.entity.js";
import { Class } from "./class.entity.js";
import { DivisionMaster } from "./division-master.entity.js";
import { CasteMaster } from "./caste-master.entity.js";

@Entity("students")
export class Student {
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
  user_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "int", nullable: true })
  parent_user_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "parent_user_id" })
  parent_user: User;

  @Column({ type: "int", nullable: true })
  class_id: number;

  @ManyToOne(() => Class, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "class_id" })
  class: Class;

  @Column({ type: "int", nullable: true })
  division_master_id: number;

  @ManyToOne(() => DivisionMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "division_master_id" })
  division_master: DivisionMaster;

  @Column({ type: "int", nullable: true })
  caste_master_id: number;

  @ManyToOne(() => CasteMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "caste_master_id" })
  caste_master: CasteMaster;

  @Column({ type: "varchar", length: 50, nullable: true })
  caste_category: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  registration_no: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  academic_year: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  aadhar_no: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  medium: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  father_name: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  father_occupation: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  father_qualification: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  mother_name: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  mother_occupation: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  mother_qualification: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  whatsapp_no: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  scholar_no: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  roll_no: string;

  @Column({ type: "date", nullable: true })
  dob: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  gender: string;

  @Column({ type: "varchar", length: 5, nullable: true })
  blood_group: string;

  @Column({ type: "text", nullable: true })
  address: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  guardian_name: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  guardian_phone: string;

  @Column({ type: "date", nullable: true })
  admission_date: string;

  @Column({ type: "boolean", default: false })
  is_deleted: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
