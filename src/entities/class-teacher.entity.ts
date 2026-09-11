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
import { User } from "./user.entity.js";

@Entity("class_teachers")
export class ClassTeacher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  class_id: number;

  @ManyToOne(() => Class, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class: Class;

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
