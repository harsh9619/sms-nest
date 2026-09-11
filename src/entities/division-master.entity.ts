import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("division_masters")
export class DivisionMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  name: string;

  @Column({ type: "varchar", length: 20, unique: true })
  code: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}

export { DivisionMaster as Division };
