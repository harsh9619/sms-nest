import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notice } from "../../entities/notice.entity.js";

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private noticeRepo: Repository<Notice>
  ) {}

  async getNotices(schoolId: number | null, audience: string | null) {
    const qb = this.noticeRepo
      .createQueryBuilder("n")
      .leftJoinAndSelect("n.creator", "u");

    if (schoolId) {
      qb.andWhere("n.school_id = :schoolId", { schoolId });
    }
    if (audience) {
      qb.andWhere("(n.audience = 'all' OR n.audience = :audience)", { audience });
    }

    qb.orderBy("n.is_pinned", "DESC").addOrderBy("n.created_at", "DESC");

    const list = await qb.getMany();
    return list.map((n) => ({
      id: String(n.id),
      title: n.title,
      content: n.content,
      audience: n.audience,
      isPinned: n.is_pinned,
      date: n.created_at ? new Date(n.created_at).toISOString().split("T")[0] : null,
      author: n.creator ? n.creator.name : "Admin",
      createdBy: n.created_by ? String(n.created_by) : null,
      schoolId: String(n.school_id),
    }));
  }

  async createNotice(schoolId: number, data: any) {
    const { title, content, audience, isPinned, createdBy } = data;

    const newNotice = this.noticeRepo.create({
      school_id: schoolId,
      title,
      content,
      audience: audience || "all",
      is_pinned: isPinned || false,
      created_by: createdBy || null,
    });

    const saved = await this.noticeRepo.save(newNotice);
    const list = await this.getNotices(schoolId, null);
    return list.find((n) => Number(n.id) === saved.id) || null;
  }

  async updateNotice(noticeId: number, data: any) {
    const { title, content, audience, isPinned } = data;

    await this.noticeRepo.update(noticeId, {
      title,
      content,
      audience,
      is_pinned: isPinned,
    });

    const n = await this.noticeRepo.findOne({ where: { id: noticeId } });
    if (!n) return null;

    const list = await this.getNotices(n.school_id, null);
    return list.find((item) => Number(item.id) === noticeId) || null;
  }

  async deleteNotice(noticeId: number) {
    const n = await this.noticeRepo.findOne({ where: { id: noticeId } });
    if (!n) return null;

    const list = await this.getNotices(n.school_id, null);
    const resultObj = list.find((item) => Number(item.id) === noticeId) || null;

    await this.noticeRepo.delete(noticeId);
    return resultObj;
  }
}
