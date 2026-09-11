import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Class } from "./class.entity.js";
import { Subject } from "./subject.entity.js";

@Entity("class_subjects")
export class ClassSubject {
  @PrimaryGeneratedColumn()
  id: number;

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

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
