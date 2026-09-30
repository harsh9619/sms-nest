import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("role_masters")
export class RoleMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  name: string;

  @Column({ type: "varchar", length: 100 })
  label: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "int", nullable: true, default: 0 })
  seq: number;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
