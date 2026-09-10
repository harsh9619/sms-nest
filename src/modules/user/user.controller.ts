import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { UserService } from "./user.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUsers(
    @Param("schoolId") schoolIdStr: string,
    @Query("all") allStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const showAll = allStr === "true";
    return this.userService.getUsers(schoolId, showAll);
  }

  @Post()
  async createUser(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const { name, email, phone, role } = body;
    if (!name || !email || !role) {
      throw new BadRequestException("Name, email, and role are required.");
    }

    const dbRole: string =
      role === "admin"
        ? "school_admin"
        : role === "teacher"
        ? "teacher"
        : role === "student"
        ? "student"
        : "teacher";

    const schoolInt = schoolIdStr || body.schoolId ? toIntID(String(schoolIdStr || body.schoolId)) : null;
    if (dbRole !== "super_admin" && !schoolInt) {
      throw new BadRequestException("School assignment is required for this role.");
    }

    try {
      const userId = await this.userService.createUser({
        name,
        email,
        phone,
        dbRole,
        schoolId: schoolInt,
      });

      return await this.userService.getFullUserRecord(userId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A user with this email already exists.");
      }
      throw err;
    }
  }

  @Put(":id")
  async updateUser(
    @Param("schoolId") schoolIdStr: string,
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const userId = toIntID(idStr);
    const existing = await this.userService.getUserById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const { name, email, phone, role } = body;
    if (!name || !email || !role) {
      throw new BadRequestException("Name, email, and role are required.");
    }

    const dbRole: string =
      role === "admin"
        ? "school_admin"
        : role === "teacher"
        ? "teacher"
        : role === "student"
        ? "student"
        : "teacher";

    const schoolInt = schoolIdStr || body.schoolId ? toIntID(String(schoolIdStr || body.schoolId)) : null;
    if (dbRole !== "super_admin" && !schoolInt) {
      throw new BadRequestException("School assignment is required for this role.");
    }

    try {
      await this.userService.updateUser(userId, {
        name,
        email,
        phone,
        dbRole,
        schoolId: schoolInt,
      });

      return await this.userService.getFullUserRecord(userId);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A user with this email already exists.");
      }
      throw err;
    }
  }

  @Delete(":id")
  async deleteUser(@Param("id") idStr: string) {
    const userId = toIntID(idStr);
    const existing = await this.userService.getFullUserRecord(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    await this.userService.deleteUser(userId);
    return existing;
  }
}
