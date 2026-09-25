import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { School } from "./school.entity.js";
import { Student } from "./student.entity.js";
import { Fee } from "./fee.entity.js";

@Entity("fee_receipts")
export class FeeReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, unique: true })
  receipt_number: string;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int" })
  student_id: number;

  @ManyToOne(() => Student, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student: Student;

  @Column({ type: "numeric", precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: "varchar", length: 50, default: "cash" })
  payment_method: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  months_covered: string;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @OneToMany(() => Fee, (fee) => fee.receipt)
  fees: Fee[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
