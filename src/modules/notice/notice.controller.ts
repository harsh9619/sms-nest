import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
} from "@nestjs/common";
import { NoticeService } from "./notice.service.js";
import { toIntID } from "../../db/index.js";

@Controller("api/:schoolId/notices")
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @Get()
  async getNotices(
    @Param("schoolId") schoolIdStr: string,
    @Query("audience") audienceStr?: string
  ) {
    const schoolId = schoolIdStr ? toIntID(String(schoolIdStr)) : null;
    const audience = audienceStr ? String(audienceStr) : null;
    return this.noticeService.getNotices(schoolId, audience);
  }

  @Post()
  async createNotice(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: any
  ) {
    const schoolId = toIntID(String(schoolIdStr));
    const { title, content, audience, isPinned, createdBy } = body;

    return this.noticeService.createNotice(schoolId, {
      title,
      content,
      audience,
      isPinned,
      createdBy: createdBy ? toIntID(createdBy) : null,
    });
  }

  @Put(":id")
  async updateNotice(
    @Param("id") idStr: string,
    @Body() body: any
  ) {
    const noticeId = toIntID(idStr);
    const { title, content, audience, isPinned } = body;

    const updated = await this.noticeService.updateNotice(noticeId, {
      title,
      content,
      audience,
      isPinned,
    });

    if (!updated) {
      throw new NotFoundException("Notice not found");
    }
    return updated;
  }

  @Delete(":id")
  async deleteNotice(@Param("id") idStr: string) {
    const noticeId = toIntID(idStr);
    const deleted = await this.noticeService.deleteNotice(noticeId);
    if (!deleted) {
      throw new NotFoundException("Notice not found");
    }
    return deleted;
  }
}
