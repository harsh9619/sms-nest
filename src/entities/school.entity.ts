import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";

@Entity("schools")
export class School {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 200, unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  address: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  logo_url: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  board: string;

  @Column({ type: "varchar", length: 20, default: "2024-25" })
  academic_year: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Column({ type: "varchar", default: "free" })
  subscription: string;

  @Column({ type: "int", default: 500 })
  max_students: number;

  @Column({ type: "text", default: "default" })
  theme: string;

  @Column({ type: "text", default: "light" })
  appearance_mode: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
