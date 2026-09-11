import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Subject } from "./subject.entity.js";
import { User } from "./user.entity.js";
import { Class } from "./class.entity.js";

@Entity("subject_teachers")
export class SubjectTeacher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  subject_id: number;

  @ManyToOne(() => Subject, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: Subject;

  @Column({ type: "int" })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "int", nullable: true })
  class_id: number;

  @ManyToOne(() => Class, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "class_id" })
  class: Class;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
