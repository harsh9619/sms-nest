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
import { SubjectMaster } from "./subject-master.entity.js";
import { Class } from "./class.entity.js";
import { User } from "./user.entity.js";

@Entity("subjects")
export class Subject {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int", nullable: true })
  subject_master_id: number;

  @ManyToOne(() => SubjectMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subject_master_id" })
  subject_master: SubjectMaster;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  code: string;

  @Column({ type: "int", nullable: true })
  class_id: number;

  @ManyToOne(() => Class, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "class_id" })
  class: Class;

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
