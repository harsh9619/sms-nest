import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from "@nestjs/common";
import { CasteService } from "./caste.service.js";

@Controller("api/castes")
export class CasteController {
  constructor(private readonly casteService: CasteService) {}

  @Get()
  async findAll() {
    return this.casteService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.casteService.findOne(id);
  }

  @Post()
  async create(@Body() body: { name: string; code: string; description?: string }) {
    return this.casteService.create(body);
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { name?: string; code?: string; description?: string }
  ) {
    return this.casteService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.casteService.remove(id);
    return { success: true };
  }
}
