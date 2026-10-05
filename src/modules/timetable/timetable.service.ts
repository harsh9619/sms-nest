import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Timetable } from "../../entities/timetable.entity.js";
import { SchoolClass } from "../../entities/school-class.entity.js";
import { ClassSubject } from "../../entities/class-subject.entity.js";
import { SubjectTeacher } from "../../entities/subject-teacher.entity.js";
import { SubjectMaster } from "../../entities/subject-master.entity.js";
import { User } from "../../entities/user.entity.js";

export interface GenerateTimetableConfig {
  classId?: number | null;
  daysOfWeek?: string[];
  startTime?: string;
  endTime?: string;
  periodDuration?: number; // minutes
  breakStartTime?: string;
  breakEndTime?: string;
  clearExisting?: boolean;
}

@Injectable()
export class TimetableService {
  constructor(
    @InjectRepository(Timetable)
    private ttRepo: Repository<Timetable>,
    @InjectRepository(SchoolClass)
    private classRepo: Repository<SchoolClass>,
    @InjectRepository(ClassSubject)
    private classSubjectRepo: Repository<ClassSubject>,
    @InjectRepository(SubjectTeacher)
    private subjectTeacherRepo: Repository<SubjectTeacher>,
    @InjectRepository(SubjectMaster)
    private subjectMasterRepo: Repository<SubjectMaster>,
    @InjectRepository(User)
    private userRepo: Repository<User>
  ) { }

  async getTimetables(
    schoolId: number | null,
    classId: number | null,
    teacherId: number | null,
    divisionId?: number | null,
    division?: string | null,
    dayOfWeek?: string | null
  ) {
    const qb = this.ttRepo
      .createQueryBuilder("tt")
      .innerJoinAndSelect("tt.class", "c")
      .innerJoinAndSelect("tt.subject_master", "sub")
      .leftJoinAndSelect("tt.teacher", "t");

    if (schoolId) {
      qb.andWhere("tt.school_id = :schoolId", { schoolId });
    }
    if (classId) {
      qb.andWhere("tt.class_id = :classId", { classId });
    }
    if (teacherId) {
      qb.andWhere("tt.teacher_id = :teacherId", { teacherId });
    }
    if (divisionId) {
      qb.andWhere("c.division_master_id = :divisionId", { divisionId });
    }
    if (division) {
      qb.andWhere("LOWER(c.division) = LOWER(:division)", { division });
    }
    if (dayOfWeek) {
      qb.andWhere("LOWER(tt.day_of_week) = LOWER(:dayOfWeek)", { dayOfWeek });
    }

    qb.orderBy("tt.day_of_week", "ASC").addOrderBy("tt.start_time", "ASC");

    const slots = await qb.getMany();
    return slots.map((s) => ({
      id: String(s.id),
      classId: String(s.class_id),
      className: s.class ? `${s.class.name}-${s.class.division || ""}` : "",
      section: s.class ? s.class.division || "" : "",
      divisionId: s.class?.division_master_id ? String(s.class.division_master_id) : null,
      subjectId: String(s.subject_master_id),
      subjectName: s.subject_master ? s.subject_master.name : "",
      teacherId: s.teacher_id ? String(s.teacher_id) : null,
      teacherName: s.teacher ? s.teacher.name : "Unassigned",
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      classroom: s.classroom,
      schoolId: String(s.school_id),
    }));
  }

  async createTimetable(schoolId: number, data: any) {
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, classroom } = data;

    const newSlot = this.ttRepo.create({
      school_id: schoolId,
      class_id: classId,
      subject_master_id: subjectId,
      teacher_id: teacherId || null,
      day_of_week: dayOfWeek.toLowerCase(),
      start_time: startTime,
      end_time: endTime,
      classroom,
    });

    const saved = await this.ttRepo.save(newSlot);
    const list = await this.getTimetables(schoolId, classId, null);
    return list.find((s) => Number(s.id) === saved.id) || null;
  }

  async updateTimetable(timetableId: number, data: any) {
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, classroom } = data;

    await this.ttRepo.update(timetableId, {
      class_id: classId,
      subject_master_id: subjectId,
      teacher_id: teacherId || null,
      day_of_week: dayOfWeek.toLowerCase(),
      start_time: startTime,
      end_time: endTime,
      classroom,
    });

    const slot = await this.ttRepo.findOne({ where: { id: timetableId } });
    if (!slot) return null;

    const list = await this.getTimetables(slot.school_id, null, null);
    return list.find((s) => Number(s.id) === timetableId) || null;
  }

  async deleteTimetable(timetableId: number) {
    const slot = await this.ttRepo.findOne({ where: { id: timetableId } });
    if (!slot) return null;

    const list = await this.getTimetables(slot.school_id, null, null);
    const resultObj = list.find((s) => Number(s.id) === timetableId) || null;

    await this.ttRepo.delete(timetableId);
    return resultObj;
  }

  /**
   * Automatic Timetable Generation Algorithm
   */
  async generateTimetable(schoolId: number, config: GenerateTimetableConfig) {
    const {
      classId,
      daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      startTime = "08:30",
      endTime = "14:30",
      periodDuration = 45,
      breakStartTime = "11:30",
      breakEndTime = "12:00",
      clearExisting = true,
    } = config;

    // 1. Determine target classes
    let targetClasses: SchoolClass[] = [];
    if (classId) {
      const cls = await this.classRepo.findOne({ where: { id: classId, school_id: schoolId } });
      if (!cls) throw new BadRequestException(`Class with ID ${classId} not found`);
      targetClasses = [cls];
    } else {
      targetClasses = await this.classRepo.find({ where: { school_id: schoolId } });
    }

    if (targetClasses.length === 0) {
      throw new BadRequestException("No classes found to generate timetable for");
    }

    // 2. Helper time conversions
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const minutesToTime = (min: number) => {
      const h = Math.floor(min / 60).toString().padStart(2, "0");
      const m = (min % 60).toString().padStart(2, "0");
      return `${h}:${m}:00`;
    };

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const breakStart = breakStartTime ? timeToMinutes(breakStartTime) : null;
    const breakEnd = breakEndTime ? timeToMinutes(breakEndTime) : null;

    // 3. Generate period time slots for a day
    const timeSlots: { startTime: string; endTime: string; startMins: number; endMins: number }[] = [];
    let current = startMin;

    while (current + periodDuration <= endMin) {
      // Check if current slot falls into break time
      if (breakStart !== null && breakEnd !== null && current >= breakStart && current < breakEnd) {
        current = breakEnd;
        continue;
      }
      const slotEnd = current + periodDuration;
      if (breakStart !== null && breakEnd !== null && current < breakStart && slotEnd > breakStart) {
        // Slot overlaps with start of break, jump to end of break
        current = breakEnd;
        continue;
      }
      if (slotEnd > endMin) break;

      timeSlots.push({
        startTime: minutesToTime(current),
        endTime: minutesToTime(slotEnd),
        startMins: current,
        endMins: slotEnd,
      });

      current = slotEnd;
    }

    if (timeSlots.length === 0) {
      throw new BadRequestException("Calculated period slots resulted in 0 available slots. Check duration and time range.");
    }

    // 4. Fetch all teachers for the school
    const allTeachers = await this.userRepo.find({
      where: { school_id: schoolId, role: "teacher" },
    });

    // 5. Fetch all subjects for the school
    const allSchoolSubjects = await this.subjectMasterRepo.find();

    if (allSchoolSubjects.length === 0) {
      throw new BadRequestException("No subjects found in subject master table. Please add subjects first.");
    }

    // 5b. Validate that all class subjects have an assigned subject teacher
    const missingSubjectTeacherErrors: string[] = [];

    for (const cls of targetClasses) {
      const classSubjectsRel = await this.classSubjectRepo.find({
        where: { class_id: cls.id, school_id: schoolId },
        relations: { subject_master: true },
      });

      let subjectsForClass = classSubjectsRel.map((cs) => cs.subject_master).filter(Boolean);
      if (subjectsForClass.length === 0) {
        subjectsForClass = allSchoolSubjects;
      }

      for (const sub of subjectsForClass) {
        const teacherAssigned = await this.subjectTeacherRepo.findOne({
          where: [
            { school_id: schoolId, class_id: cls.id, subject_master_id: sub.id },
            { school_id: schoolId, subject_master_id: sub.id },
          ],
        });

        if (!teacherAssigned) {
          missingSubjectTeacherErrors.push(
            `Class ${cls.name}${cls.division ? "-" + cls.division : ""} (${sub.name})`
          );
        }
      }
    }

    if (missingSubjectTeacherErrors.length > 0) {
      throw new BadRequestException(
        `Cannot generate timetable: All class subjects must have an assigned subject teacher. Unassigned: ${missingSubjectTeacherErrors.join(
          "; "
        )}. Please assign subject teachers to all class subjects first.`
      );
    }

    // 6. Optionally clear existing timetables for target classes
    const targetClassIds = targetClasses.map((c) => c.id);
    if (clearExisting) {
      await this.ttRepo.delete({ school_id: schoolId, class_id: In(targetClassIds) });
    }

    // 7. Track teacher occupancy: teacherOccupied[teacherId][day][slotIndex] = true
    const teacherOccupied: Record<number, Record<string, Record<number, boolean>>> = {};
    const markTeacherOccupied = (tId: number, day: string, slotIdx: number) => {
      if (!teacherOccupied[tId]) teacherOccupied[tId] = {};
      if (!teacherOccupied[tId][day]) teacherOccupied[tId][day] = {};
      teacherOccupied[tId][day][slotIdx] = true;
    };

    const isTeacherFree = (tId: number, day: string, slotIdx: number) => {
      return !teacherOccupied[tId]?.[day]?.[slotIdx];
    };

    // Pre-populate occupancy from existing timetable slots if not clearExisting
    if (!clearExisting) {
      const existingSlots = await this.ttRepo.find({ where: { school_id: schoolId } });
      for (const slot of existingSlots) {
        if (!slot.teacher_id) continue;
        const day = slot.day_of_week.toLowerCase();
        const sMin = timeToMinutes(slot.start_time);
        timeSlots.forEach((ts, idx) => {
          if (ts.startMins === sMin) {
            markTeacherOccupied(slot.teacher_id!, day, idx);
          }
        });
      }
    }

    const newSlotsToSave: Partial<Timetable>[] = [];
    const warnings: string[] = [];

    // 8. Generate timetable per class
    for (const cls of targetClasses) {
      // Fetch subjects linked to this class
      const classSubjectsRel = await this.classSubjectRepo.find({
        where: { class_id: cls.id, school_id: schoolId },
        relations: { subject_master: true },
      });

      let subjectsForClass = classSubjectsRel.map((cs) => cs.subject_master).filter(Boolean);
      if (subjectsForClass.length === 0) {
        // Fallback to all school subjects
        subjectsForClass = allSchoolSubjects;
      }

      // Pre-fetch subject-teacher assignments
      const subjectTeacherRels = await this.subjectTeacherRepo.find({
        where: { school_id: schoolId, class_id: cls.id },
      });

      // Build subject to teachers map
      const subjectTeachersMap: Record<number, number[]> = {};
      for (const st of subjectTeacherRels) {
        if (!subjectTeachersMap[st.subject_master_id]) {
          subjectTeachersMap[st.subject_master_id] = [];
        }
        subjectTeachersMap[st.subject_master_id].push(st.teacher_id);
      }

      let subjectIndex = 0;

      for (const dayRaw of daysOfWeek) {
        const day = dayRaw.toLowerCase();

        for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
          const slotTime = timeSlots[slotIdx];

          // Rotate subject selection
          const currentSubject = subjectsForClass[subjectIndex % subjectsForClass.length];
          subjectIndex++;

          // Determine teacher for this subject
          let assignedTeacherId: number | null = null;
          const qualifiedTeacherIds = subjectTeachersMap[currentSubject.id] || [];

          // Try finding a qualified teacher who is free
          for (const tId of qualifiedTeacherIds) {
            if (isTeacherFree(tId, day, slotIdx)) {
              assignedTeacherId = tId;
              break;
            }
          }

          // If no qualified teacher assigned specifically for class/subject is free, try any school teacher free
          if (!assignedTeacherId && allTeachers.length > 0) {
            for (const t of allTeachers) {
              if (isTeacherFree(t.id, day, slotIdx)) {
                assignedTeacherId = t.id;
                break;
              }
            }
          }

          if (assignedTeacherId) {
            markTeacherOccupied(assignedTeacherId, day, slotIdx);
          } else if (allTeachers.length > 0) {
            warnings.push(`Day ${day.toUpperCase()} Period ${slotIdx + 1} (${slotTime.startTime.substring(0, 5)}): All teachers were occupied for Class ${cls.name}`);
          }

          newSlotsToSave.push({
            school_id: schoolId,
            class_id: cls.id,
            subject_master_id: currentSubject.id,
            teacher_id: assignedTeacherId,
            day_of_week: day,
            start_time: slotTime.startTime,
            end_time: slotTime.endTime,
            classroom: `Room ${cls.name}${cls.division ? "-" + cls.division : ""}`,
          });
        }
      }
    }

    // 9. Save all created slots to database
    const savedEntities = await this.ttRepo.save(this.ttRepo.create(newSlotsToSave as any));

    // Return summary and updated timetables list for target classes
    const resultList = await this.getTimetables(schoolId, classId || null, null);

    return {
      message: `Successfully generated ${savedEntities.length} timetable slots across ${targetClasses.length} class(es).`,
      generatedSlotsCount: savedEntities.length,
      classesCount: targetClasses.length,
      periodsPerDay: timeSlots.length,
      daysCount: daysOfWeek.length,
      warnings,
      timetables: resultList,
    };
  }
}

