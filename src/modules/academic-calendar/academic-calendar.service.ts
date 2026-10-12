import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademicCalendarEvent } from "../../entities/academic-calendar-event.entity.js";
import { SchoolWorkingDay } from "../../entities/school-working-day.entity.js";
import { AcademicYear } from "../../entities/academic-year.entity.js";
import { SchoolAcademicYear } from "../../entities/school-academic-year.entity.js";

@Injectable()
export class AcademicCalendarService {
  constructor(
    @InjectRepository(AcademicCalendarEvent)
    private eventRepo: Repository<AcademicCalendarEvent>,
    @InjectRepository(SchoolWorkingDay)
    private workingDayRepo: Repository<SchoolWorkingDay>,
    @InjectRepository(AcademicYear)
    private ayRepo: Repository<AcademicYear>,
    @InjectRepository(SchoolAcademicYear)
    private sayRepo: Repository<SchoolAcademicYear>
  ) { }

  async getEvents(schoolId: number, queryParams?: { month?: string; type?: string; role?: string }) {
    const qb = this.eventRepo
      .createQueryBuilder("e")
      .where("e.school_id = :schoolId", { schoolId });

    if (queryParams?.type && queryParams.type !== "ALL") {
      if (queryParams.type === "HOLIDAY") {
        qb.andWhere("(e.type = 'HOLIDAY' OR e.is_holiday = true)");
      } else {
        qb.andWhere("e.type = :type", { type: queryParams.type });
      }
    }

    if (queryParams?.month) {
      // YYYY-MM
      qb.andWhere(
        "(TO_CHAR(e.start_date, 'YYYY-MM') = :month OR TO_CHAR(e.end_date, 'YYYY-MM') = :month)",
        { month: queryParams.month }
      );
    }

    qb.orderBy("e.start_date", "ASC");

    const events = await qb.getMany();
    return events.map((ev) => this.mapEvent(ev));
  }

  async getWorkingConfig(schoolId: number) {
    const say = await this.sayRepo.findOne({
      where: { school_id: schoolId, is_current: true },
      relations: { academic_year: true },
    });

    let workingConfig = await this.workingDayRepo.findOne({
      where: { school_id: schoolId },
    });

    if (!workingConfig) {
      const startDate = null;
      const endDate = null;

      workingConfig = this.workingDayRepo.create({
        school_id: schoolId,
        school_academic_year_id: say?.id || undefined,
        session_start_date: startDate,
        session_end_date: endDate,
        working_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
        periods_per_day: 8,
        school_start_time: null,
        school_end_time: null,
      });
      workingConfig = await this.workingDayRepo.save(workingConfig);
    } else if (!workingConfig.school_academic_year_id && say?.id) {
      workingConfig.school_academic_year_id = say.id;
      await this.workingDayRepo.save(workingConfig);
    }

    // Calculate total working days in current session excluding Sundays & Holidays
    const holidays = await this.eventRepo.find({
      where: [
        { school_id: schoolId, is_holiday: true },
        { school_id: schoolId, type: "HOLIDAY" },
      ],
    });

    const holidayDates = new Set<string>();
    holidays.forEach((h) => {
      let cur = new Date(h.start_date);
      const end = new Date(h.end_date);
      while (cur <= end) {
        holidayDates.add(cur.toISOString().split("T")[0]);
        cur.setDate(cur.getDate() + 1);
      }
    });

    let totalWorkingDays = 0;
    if (workingConfig.session_start_date && workingConfig.session_end_date) {
      let cur = new Date(workingConfig.session_start_date);
      const end = new Date(workingConfig.session_end_date);
      const activeDays = (workingConfig.working_days || []).map((d) => d.toLowerCase());

      const daysMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      while (cur <= end) {
        const dateStr = cur.toISOString().split("T")[0];
        const dayName = daysMap[cur.getDay()];
        if (activeDays.includes(dayName) && !holidayDates.has(dateStr)) {
          totalWorkingDays++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    return {
      id: String(workingConfig.id),
      schoolId: String(workingConfig.school_id),
      schoolAcademicYearId: workingConfig.school_academic_year_id ? String(workingConfig.school_academic_year_id) : null,
      sessionStartDate: workingConfig.session_start_date,
      sessionEndDate: workingConfig.session_end_date,
      workingDays: workingConfig.working_days || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      periodsPerDay: workingConfig.periods_per_day,
      schoolStartTime: workingConfig.school_start_time,
      schoolEndTime: workingConfig.school_end_time,
      totalWorkingDays,
    };
  }

  async getCalendarOverview(schoolId: number, queryParams?: { month?: string; type?: string; role?: string }) {
    const sessionConfig = await this.getWorkingConfig(schoolId);
    const events = await this.getEvents(schoolId, queryParams);
    const holidays = events.filter((ev) => ev.isHoliday || ev.type === "HOLIDAY");

    return {
      sessionConfig,
      events,
      summary: {
        totalEvents: events.length,
        totalHolidays: holidays.length,
        totalWorkingDays: sessionConfig.totalWorkingDays || 0,
      },
    };
  }

  async createEvent(schoolId: number, userId: number | null, dto: any) {
    const say = await this.sayRepo.findOne({
      where: { school_id: schoolId, is_current: true },
    });

    const isHoliday = dto.type === "HOLIDAY" || Boolean(dto.isHoliday);
    const event = this.eventRepo.create({
      school_id: schoolId,
      school_academic_year_id: dto.schoolAcademicYearId ? Number(dto.schoolAcademicYearId) : say?.id || undefined,
      title: dto.title,
      type: dto.type || (isHoliday ? "HOLIDAY" : "EVENT"),
      category: dto.category || (isHoliday ? "School Holiday" : "General Event"),
      start_date: dto.startDate,
      end_date: dto.endDate || dto.startDate,
      start_time: dto.startTime || null,
      end_time: dto.endTime || null,
      description: dto.description || "",
      location: dto.location || "",
      target_roles: Array.isArray(dto.targetRoles) ? dto.targetRoles.join(",") : dto.targetRoles || "all",
      is_holiday: isHoliday,
      affects_attendance: dto.affectsAttendance !== undefined ? Boolean(dto.affectsAttendance) : isHoliday,
      color: dto.color || (isHoliday ? "rose" : dto.type === "EXAM" ? "amber" : "indigo"),
      created_by: userId || undefined,
    });

    const saved = await this.eventRepo.save(event);
    return this.mapEvent(saved);
  }

  async updateEvent(id: number, schoolId: number, dto: any) {
    const event = await this.eventRepo.findOne({
      where: { id, school_id: schoolId },
    });
    if (!event) {
      throw new NotFoundException("Calendar event not found.");
    }

    const isHoliday = dto.type === "HOLIDAY" || Boolean(dto.isHoliday);

    if (dto.schoolAcademicYearId !== undefined) {
      event.school_academic_year_id = dto.schoolAcademicYearId ? Number(dto.schoolAcademicYearId) : (null as any);
    }
    event.title = dto.title !== undefined ? dto.title : event.title;
    event.type = dto.type !== undefined ? dto.type : event.type;
    event.category = dto.category !== undefined ? dto.category : event.category;
    event.start_date = dto.startDate !== undefined ? dto.startDate : event.start_date;
    event.end_date = dto.endDate !== undefined ? dto.endDate : event.end_date;
    event.start_time = dto.startTime !== undefined ? dto.startTime : event.start_time;
    event.end_time = dto.endTime !== undefined ? dto.endTime : event.end_time;
    event.description = dto.description !== undefined ? dto.description : event.description;
    event.location = dto.location !== undefined ? dto.location : event.location;
    event.target_roles = Array.isArray(dto.targetRoles)
      ? dto.targetRoles.join(",")
      : dto.targetRoles !== undefined
        ? dto.targetRoles
        : event.target_roles;
    event.is_holiday = isHoliday;
    event.affects_attendance = dto.affectsAttendance !== undefined ? Boolean(dto.affectsAttendance) : event.affects_attendance;
    event.color = dto.color !== undefined ? dto.color : event.color;

    const updated = await this.eventRepo.save(event);
    return this.mapEvent(updated);
  }

  async deleteEvent(id: number, schoolId: number) {
    const event = await this.eventRepo.findOne({
      where: { id, school_id: schoolId },
    });
    if (!event) {
      throw new NotFoundException("Calendar event not found.");
    }
    await this.eventRepo.remove(event);
    return { success: true, message: "Calendar event deleted successfully." };
  }

  async updateWorkingConfig(schoolId: number, dto: any) {
    const say = await this.sayRepo.findOne({
      where: { school_id: schoolId, is_current: true },
    });

    let config = await this.workingDayRepo.findOne({
      where: { school_id: schoolId },
    });
    if (!config) {
      config = this.workingDayRepo.create({ school_id: schoolId, school_academic_year_id: say?.id });
    } else if (!config.school_academic_year_id && say?.id) {
      config.school_academic_year_id = say.id;
    }

    if (dto.sessionStartDate) config.session_start_date = dto.sessionStartDate;
    if (dto.sessionEndDate) config.session_end_date = dto.sessionEndDate;
    if (Array.isArray(dto.workingDays)) config.working_days = dto.workingDays;
    if (dto.periodsPerDay) config.periods_per_day = Number(dto.periodsPerDay);
    if (dto.schoolStartTime) config.school_start_time = dto.schoolStartTime;
    if (dto.schoolEndTime) config.school_end_time = dto.schoolEndTime;

    const saved = await this.workingDayRepo.save(config);

    // Also sync session dates with current SchoolAcademicYear / AcademicYear if present
    if (dto.sessionStartDate && dto.sessionEndDate) {
      const sayFull = await this.sayRepo.findOne({
        where: { school_id: schoolId, is_current: true },
        relations: { academic_year: true },
      });
      if (sayFull && sayFull.academic_year) {
        await this.ayRepo.update(sayFull.academic_year.id, {
          start_date: dto.sessionStartDate,
          end_date: dto.sessionEndDate,
        });
      }
    }

    return {
      id: String(saved.id),
      schoolId: String(saved.school_id),
      schoolAcademicYearId: saved.school_academic_year_id ? String(saved.school_academic_year_id) : null,
      sessionStartDate: saved.session_start_date,
      sessionEndDate: saved.session_end_date,
      workingDays: saved.working_days,
      periodsPerDay: saved.periods_per_day,
      schoolStartTime: saved.school_start_time,
      schoolEndTime: saved.school_end_time,
    };
  }

  private mapEvent(ev: AcademicCalendarEvent) {
    return {
      id: String(ev.id),
      schoolId: String(ev.school_id),
      schoolAcademicYearId: ev.school_academic_year_id ? String(ev.school_academic_year_id) : null,
      title: ev.title,
      type: ev.type,
      category: ev.category,
      startDate: ev.start_date,
      endDate: ev.end_date,
      startTime: ev.start_time,
      endTime: ev.end_time,
      description: ev.description,
      location: ev.location,
      targetRoles: ev.target_roles ? ev.target_roles.split(",").map((r) => r.trim()) : ["all"],
      isHoliday: ev.is_holiday,
      affectsAttendance: ev.affects_attendance,
      color: ev.color,
      createdBy: ev.created_by ? String(ev.created_by) : null,
      createdAt: ev.created_at,
    };
  }
}
