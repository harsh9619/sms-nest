import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("master_themes")
export class MasterTheme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", unique: true })
  name: string;

  @Column({ type: "text" })
  label: string;

  @Column({ type: "text" })
  color: string;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Column({ type: "int", default: 0 })
  sort_order: number;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;
}
