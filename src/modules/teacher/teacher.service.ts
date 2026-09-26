import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "../../entities/user.entity.js";
import { AcademicYearService } from "../academic-year/academic-year.service.js";
import { getRoleId } from "../../common/utils/role.util.js";
import { generateUniqueUsername } from "../../common/utils/username.util.js";
import { hashPassword, getDefaultHashedPassword } from "../../common/utils/password.util.js";
import fs from "fs";
import path from "path";

import { RoleMaster } from "../../entities/role-master.entity.js";

export interface GetTeachersOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RoleMaster)
    private roleMasterRepo: Repository<RoleMaster>,
    private ayService: AcademicYearService
  ) { }

  async getRoles() {
    const roles = await this.roleMasterRepo.find({ order: { id: "ASC" } });
    return roles.map((r) => ({
      roleId: r.id,
      roleName: r.name,
      label: r.label,
      description: r.description,
    }));
  }

  private processAvatarUrl(avatarInput?: string): string | null {
    if (!avatarInput) return null;

    // If base64 encoded data string, decode and write file to /uploads directory
    if (avatarInput.startsWith("data:image/")) {
      try {
        const matches = avatarInput.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const base64Data = matches[2];
          const fileName = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const uploadsDir = path.join(process.cwd(), "uploads");

          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
          return `/uploads/${fileName}`;
        }
      } catch (err) {
        console.error("Failed to save avatar image file:", err);
      }
    }

    return avatarInput;
  }

  async getTeachers(
    schoolId?: number,
    academicYearHeader?: string,
    options?: GetTeachersOptions
  ) {
    const page = options?.page && options.page > 0 ? Number(options.page) : undefined;
    const limit = options?.limit && options.limit > 0 ? Number(options.limit) : undefined;
    const skip = page && limit ? (page - 1) * limit : undefined;

    let sayId: number | null = null;
    if (academicYearHeader) {
      sayId = await this.ayService.getSchoolAcademicYearId(schoolId, academicYearHeader);
    }

    const qb = this.userRepo
      .createQueryBuilder("u")
      .leftJoin("u.role_master", "rm")
      .select([
        "u.id AS id",
        "u.name AS name",
        "u.email AS email",
        "u.phone AS phone",
        "u.avatar_url AS avatar",
        "u.created_at AS joinDate",
        "u.school_id AS schoolId",
        "u.is_active AS status",
        "u.role_id AS roleId",
        "COALESCE(rm.name, u.role::text) AS roleName",
      ])
      .where("(u.role IN (:...roles) OR rm.name IN (:...roleNames))", {
        roles: [UserRole.TEACHER, UserRole.PRINCIPAL],
        roleNames: ["teacher", "principal", "Teacher", "Principal"],
      });

    if (schoolId) {
      qb.andWhere("u.school_id = :schoolId", { schoolId });
    }

    if (options?.search) {
      const s = `%${options.search.trim()}%`;
      qb.andWhere(
        "(LOWER(u.name) LIKE LOWER(:s) OR LOWER(u.email) LIKE LOWER(:s) OR LOWER(u.phone) LIKE LOWER(:s))",
        { s }
      );
    }

    if (options?.status && options.status !== "all") {
      const isActive = options.status === "active";
      qb.andWhere("u.is_active = :isActive", { isActive });
    }

    qb.orderBy("u.name", "ASC");

    const total = await qb.getCount();

    if (skip !== undefined && limit !== undefined) {
      qb.offset(skip).limit(limit);
    }

    const rawTeachers = await qb.getRawMany();

    const formattedTeachers = rawTeachers.map((t) => ({
      id: String(t.id),
      name: t.name,
      email: t.email,
      phone: t.phone,
      avatar: t.avatar,
      joinDate: t.joindate ? new Date(t.joindate).toISOString() : null,
      schoolId: t.schoolid ? String(t.schoolid) : null,
      status: t.status,
      roleId: t.roleid ? Number(t.roleid) : getRoleId(UserRole.TEACHER),
      roleName: t.rolename || UserRole.TEACHER,
      schoolAcademicYearId: sayId ? String(sayId) : null,
    }));

    if (page && limit) {
      return {
        data: formattedTeachers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    return formattedTeachers;
  }

  async getTeacherById(id: number) {
    const t = await this.userRepo.findOne({
      where: [
        { id, role: UserRole.TEACHER },
        { id, role: UserRole.PRINCIPAL },
      ],
      relations: { role_master: true },
    });
    if (!t) return null;
    return {
      id: String(t.id),
      name: t.name,
      email: t.email,
      phone: t.phone,
      avatar: t.avatar_url,
      joinDate: t.created_at ? new Date(t.created_at).toISOString() : null,
      schoolId: t.school_id ? String(t.school_id) : null,
      status: t.is_active,
      roleId: t.role_id ? Number(t.role_id) : getRoleId(UserRole.TEACHER),
      roleName: t.role_master ? t.role_master.name : t.role || UserRole.TEACHER,
    };
  }

  async checkEmailExists(email: string, schoolId?: number, excludeUserId?: number): Promise<boolean> {
    const qb = this.userRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email: email.trim() });

    if (schoolId) {
      qb.andWhere("u.school_id = :schoolId", { schoolId });
    }

    if (excludeUserId) {
      qb.andWhere("u.id != :excludeUserId", { excludeUserId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  async createTeacher(
    schoolId: number,
    data: {
      name: string;
      email: string;
      phone?: string;
      avatar_url?: string;
      status?: boolean;
      roleId?: number | string;
      role?: string;
    }
  ) {
    const defaultPassword = await getDefaultHashedPassword();
    const processedAvatar = this.processAvatarUrl(data.avatar_url);

    let roleMaster: RoleMaster | null = null;
    if (data.roleId) {
      roleMaster = await this.roleMasterRepo.findOne({ where: { id: Number(data.roleId) } });
    }
    if (!roleMaster && data.role) {
      roleMaster = await this.roleMasterRepo.findOne({
        where: [
          { name: data.role },
          { label: data.role },
        ],
      });
    }

    const validRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.SCHOOL_ADMIN,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.PARENT,
    ];

    let userRoleStr = UserRole.TEACHER;
    if (data.role && validRoles.includes(data.role as any)) {
      userRoleStr = data.role as UserRole;
    } else if (roleMaster && validRoles.includes(roleMaster.name as any)) {
      userRoleStr = roleMaster.name as UserRole;
    }

    const computedRoleId = roleMaster ? roleMaster.id : (data.roleId ? Number(data.roleId) : getRoleId(userRoleStr));

    const resolvedUserName = await generateUniqueUsername(this.userRepo, {
      explicitUsername: (data as any).user_name || (data as any).userName,
      email: data.email,
      name: data.name,
      role: userRoleStr,
    });

    const user = this.userRepo.create({
      school_id: schoolId,
      name: data.name,
      user_name: resolvedUserName,
      email: data.email.trim(),
      password: defaultPassword,
      role_id: computedRoleId,
      role: userRoleStr,
      phone: data.phone || null,
      avatar_url: processedAvatar,
      is_active: data.status !== undefined ? Boolean(data.status) : true,
    });

    const saved = await this.userRepo.save(user);

    return {
      id: String(saved.id),
      name: saved.name,
      email: saved.email,
      phone: saved.phone,
      avatar: saved.avatar_url,
      joinDate: saved.created_at ? new Date(saved.created_at).toISOString() : new Date().toISOString(),
      schoolId: saved.school_id ? String(saved.school_id) : String(schoolId),
      status: saved.is_active,
      roleId: saved.role_id,
      roleName: roleMaster ? roleMaster.name : saved.role,
    };
  }

  async updateTeacher(
    id: number,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      avatar_url?: string;
      status?: boolean;
      roleId?: number | string;
      role?: string;
    }
  ) {
    const processedAvatar = data.avatar_url !== undefined ? this.processAvatarUrl(data.avatar_url) : undefined;

    let roleMaster: RoleMaster | null = null;
    if (data.roleId) {
      roleMaster = await this.roleMasterRepo.findOne({ where: { id: Number(data.roleId) } });
    }
    if (!roleMaster && data.role) {
      roleMaster = await this.roleMasterRepo.findOne({
        where: [
          { name: data.role },
          { label: data.role },
        ],
      });
    }

    const validRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.SCHOOL_ADMIN,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.PARENT,
      UserRole.PRINCIPAL
    ];

    let userRoleStr: string | undefined = undefined;
    if (data.role) {
      userRoleStr = validRoles.includes(data.role as any) ? data.role : UserRole.TEACHER;
    } else if (roleMaster) {
      userRoleStr = validRoles.includes(roleMaster.name as any) ? roleMaster.name : UserRole.TEACHER;
    }

    const computedRoleId = roleMaster ? roleMaster.id : (data.roleId ? Number(data.roleId) : (userRoleStr ? getRoleId(userRoleStr) : undefined));

    await this.userRepo.update(id, {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email.trim() }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(processedAvatar !== undefined && { avatar_url: processedAvatar }),
      ...(data.status !== undefined && { is_active: Boolean(data.status) }),
      ...(computedRoleId !== undefined && { role_id: computedRoleId }),
      ...(userRoleStr !== undefined && { role: userRoleStr }),
    });

    return this.getTeacherById(id);
  }

  async deleteTeacher(id: number) {
    await this.userRepo.update(id, { is_active: false });
  }

  async bulkCreateTeachers(
    schoolId: number,
    teachers: Array<{ name: string; email: string; phone?: string; roleId?: number | string; role?: string }>
  ) {
    const defaultPassword = await getDefaultHashedPassword();
    const results = {
      addedCount: 0,
      skippedCount: 0,
      errors: [] as Array<{ email: string; reason: string }>,
    };

    const allRoles = await this.roleMasterRepo.find();
    const validRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.SCHOOL_ADMIN,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.PARENT,
      UserRole.PRINCIPAL,
    ];

    for (const t of teachers) {
      const email = t.email ? String(t.email).trim().toLowerCase() : "";
      const phone = t.phone ? String(t.phone).trim() : "";

      if (!t.name || !email) {
        results.skippedCount++;
        results.errors.push({ email: email || "N/A", reason: "Name and Email are required" });
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.skippedCount++;
        results.errors.push({ email, reason: "Invalid email format" });
        continue;
      }

      if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        results.skippedCount++;
        results.errors.push({ email, reason: "Phone must be a valid 10-digit number starting with 6-9" });
        continue;
      }

      const emailExists = await this.checkEmailExists(email, schoolId);
      if (emailExists) {
        results.skippedCount++;
        results.errors.push({ email, reason: "Email already exists" });
        continue;
      }

      try {
        let matchedRole = t.roleId
          ? allRoles.find((r) => r.id === Number(t.roleId))
          : undefined;

        if (!matchedRole && t.role) {
          const searchRoleStr = String(t.role).trim().toLowerCase();
          matchedRole = allRoles.find(
            (r) => r.name.toLowerCase() === searchRoleStr || r.label.toLowerCase() === searchRoleStr
          );
        }

        const userRoleStr = t.role && validRoles.includes(t.role as any)
          ? t.role
          : (matchedRole && validRoles.includes(matchedRole.name as any) ? matchedRole.name : UserRole.TEACHER);

        const computedRoleId = matchedRole ? matchedRole.id : (t.roleId ? Number(t.roleId) : getRoleId(userRoleStr));

        const resolvedUserName = await generateUniqueUsername(this.userRepo, {
          explicitUsername: (t as any).user_name || (t as any).userName,
          email,
          name: t.name,
          role: userRoleStr,
        });

        const user = this.userRepo.create({
          school_id: schoolId,
          name: t.name.trim(),
          user_name: resolvedUserName,
          email,
          password: defaultPassword,
          role_id: computedRoleId,
          role: userRoleStr,
          phone: phone || null,
          is_active: true,
        });

        await this.userRepo.save(user);
        results.addedCount++;
      } catch (err: any) {
        results.skippedCount++;
        results.errors.push({ email, reason: err.message || "Failed to create teacher" });
      }
    }

    return results;
  }
}


