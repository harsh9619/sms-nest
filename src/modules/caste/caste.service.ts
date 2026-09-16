import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CasteMaster } from "../../entities/caste-master.entity.js";

@Injectable()
export class CasteService {
  constructor(
    @InjectRepository(CasteMaster)
    private casteRepo: Repository<CasteMaster>
  ) {}

  async findAll(): Promise<CasteMaster[]> {
    return this.casteRepo.find({
      order: { id: "ASC" },
    });
  }

  async findOne(id: number): Promise<CasteMaster> {
    const caste = await this.casteRepo.findOne({ where: { id } });
    if (!caste) {
      throw new NotFoundException(`Caste with ID ${id} not found`);
    }
    return caste;
  }

  async create(data: { name: string; code: string; description?: string }): Promise<CasteMaster> {
    const caste = this.casteRepo.create(data);
    return this.casteRepo.save(caste);
  }

  async update(id: number, data: Partial<CasteMaster>): Promise<CasteMaster> {
    const caste = await this.findOne(id);
    Object.assign(caste, data);
    return this.casteRepo.save(caste);
  }

  async remove(id: number): Promise<void> {
    const caste = await this.findOne(id);
    await this.casteRepo.remove(caste);
  }
}
