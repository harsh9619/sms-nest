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
import { SchoolAcademicYear } from "./school-academic-year.entity.js";

@Entity("academic_calendar_events")
export class AcademicCalendarEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  school_id: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "school_id" })
  school: School;

  @Column({ type: "int", nullable: true })
  school_academic_year_id: number;

  @ManyToOne(() => SchoolAcademicYear, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "school_academic_year_id" })
  school_academic_year: SchoolAcademicYear;

  @Column({ type: "varchar", length: 250 })
  title: string;

  @Column({ type: "varchar", length: 50, default: "EVENT" }) // HOLIDAY, EVENT, EXAM, MEETING, SPORTS, OTHER
  type: string;

  @Column({ type: "varchar", length: 100, nullable: true }) // National Holiday, Festival, Academic, Co-Curricular, etc.
  category: string;

  @Column({ type: "date" })
  start_date: string;

  @Column({ type: "date" })
  end_date: string;

  @Column({ type: "varchar", length: 10, nullable: true }) // e.g. "09:00"
  start_time: string;

  @Column({ type: "varchar", length: 10, nullable: true }) // e.g. "17:00"
  end_time: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  location: string;

  @Column({ type: "varchar", length: 255, default: "all" }) // all, students, teachers, parents, principal
  target_roles: string;

  @Column({ type: "boolean", default: false })
  is_holiday: boolean;

  @Column({ type: "boolean", default: true })
  affects_attendance: boolean;

  @Column({ type: "varchar", length: 30, nullable: true }) // e.g. "emerald", "amber", "rose", "indigo", "purple", "blue"
  color: string;

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
