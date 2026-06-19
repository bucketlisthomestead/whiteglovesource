import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PieceCatalogItem } from '../entities/piece-catalog-item.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(PieceCatalogItem)
    private readonly catalogRepo: Repository<PieceCatalogItem>,
  ) {}

  findAll() {
    return this.catalogRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  findByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.catalogRepo
      .createQueryBuilder('c')
      .where('c.id IN (:...ids)', { ids })
      .andWhere('c.isActive = true')
      .getMany();
  }
}
