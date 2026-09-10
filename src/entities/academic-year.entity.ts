import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("academic_years")
export class AcademicYear {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 20, unique: true })
  label: string;

  @Column({ type: "date" })
  start_date: string;

  @Column({ type: "date" })
  end_date: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
