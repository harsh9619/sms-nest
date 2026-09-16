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
import { RoleMaster } from "./role-master.entity.js";

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  SCHOOL_ADMIN = "school_admin",
  TEACHER = "teacher",
  STUDENT = "student",
  PARENT = "parent",
  PRINCIPAL = "principal",

}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", nullable: true })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 150 })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({ type: "int", nullable: true })
  role_id: number;

  @ManyToOne(() => RoleMaster, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "role_id" })
  role_master: RoleMaster;

  @Column({ type: "varchar", length: 50, default: UserRole.STUDENT })
  role: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  avatar_url: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Column({ type: "timestamptz", nullable: true })
  last_login: Date;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
