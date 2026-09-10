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

@Entity("notices")
export class Notice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "varchar", length: 250 })
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "varchar", default: "all" })
  audience: string;

  @Column({ type: "boolean", default: false })
  is_pinned: boolean;

  @Column({ type: "int", nullable: true })
  created_by: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "created_by" })
  creator: User;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
