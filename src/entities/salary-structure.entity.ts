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
import { User } from "./user.entity.js";

@Entity("salary_structures")
export class SalaryStructure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int" })
  teacher_id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id" })
  teacher: User;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  basic_salary: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  hra: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  da: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  other_allowance: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  pf_deduction: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  tax_deduction: number;

  @Column({ type: "date", default: () => "CURRENT_DATE" })
  effective_from: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
