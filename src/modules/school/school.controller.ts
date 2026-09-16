import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { SchoolService } from "./school.service.js";
import { JwtAuthGuard } from "../../common/guards/auth.guard.js";

@Controller()
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get("health")
  getHealth() {
    return { status: "ok", time: new Date().toISOString() };
  }

  @Get("api/master-themes")
  async getMasterThemes() {
    return this.schoolService.getMasterThemes();
  }

  @Get("api/schools")
  @UseGuards(JwtAuthGuard)
  async getSchools(
    @Req() req: any,
    @Query("schoolId") schoolId?: string,
    @Query("search") search?: string
  ) {
    const parsedId = schoolId ? Number(schoolId) : undefined;
    return this.schoolService.getSchools(parsedId, search, req.user);
  }

  @Get("api/schools/:id")
  async getSchoolById(@Param("id") id: string) {
    const school = await this.schoolService.getSchoolById(Number(id));
    if (!school) {
      throw new NotFoundException("School not found");
    }
    return school;
  }

  @Post("api/schools")
  async createSchool(@Body() body: any) {
    const { name, slug } = body;
    if (!name || !slug) {
      throw new BadRequestException("Name and slug are required.");
    }
    try {
      return await this.schoolService.createSchool(body);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A school with this slug or email already exists.");
      }
      throw err;
    }
  }

  @Put("api/schools/:id")
  async updateSchool(@Param("id") id: string, @Body() body: any) {
    const numId = Number(id);
    const existing = await this.schoolService.getSchoolById(numId);
    if (!existing) {
      throw new NotFoundException("School not found");
    }
    const { name, slug } = body;
    if (!name || !slug) {
      throw new BadRequestException("Name and slug are required.");
    }
    try {
      return await this.schoolService.updateSchool(numId, body);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new BadRequestException("A school with this slug or email already exists.");
      }
      throw err;
    }
  }

  @Delete("api/schools/:id")
  async deleteSchool(@Param("id") id: string) {
    const numId = Number(id);
    const existing = await this.schoolService.getSchoolById(numId);
    if (!existing) {
      throw new NotFoundException("School not found");
    }
    return this.schoolService.deleteSchool(numId);
  }
}
