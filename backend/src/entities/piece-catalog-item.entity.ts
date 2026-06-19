import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PieceCatalogCategory } from '../common/enums';

@Entity('piece_catalog_items')
export class PieceCatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PieceCatalogCategory })
  category: PieceCatalogCategory;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  pickupFee: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  storageFeeMonthly: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  installFee: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
