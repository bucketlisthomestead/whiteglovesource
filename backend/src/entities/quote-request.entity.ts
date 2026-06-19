import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuoteStatus, StorageType, ChangeOrderType } from '../common/enums';
import type { QuoteLineItem, QuoteRoomInput } from '../common/quote-pricing';

export interface QuoteRemovalTargets {
  pieceIds: string[];
  roomIds: string[];
}

@Entity('quote_requests')
export class QuoteRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contactName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string | null;

  @Column()
  serviceType: string;

  @Column({ type: 'text' })
  projectDescription: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  propertyAddress: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  pickupAddress: string | null;

  @Column({ type: 'int', nullable: true })
  estimatedPieces: number;

  @Column({ type: 'date', nullable: true })
  preferredDate: string | null;

  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.PENDING })
  status: QuoteStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedTotal: number;

  @Column({ type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ type: 'int', default: 0 })
  milesToStorage: number;

  @Column({ type: 'int', default: 0 })
  milesToInstall: number;

  @Column({ type: 'int', default: 1 })
  storageMonths: number;

  @Column({
    type: 'enum',
    enum: StorageType,
    default: StorageType.STANDARD_CLIMATE,
  })
  storageType: StorageType;

  @Column({ type: 'int', default: 1 })
  pickupLocationCount: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  storageLocationId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  storageLocationName: string | null;

  /** Null = use business default */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mileRate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  projectBaseFee: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  additionalPickupSurcharge: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumQuote: number | null;

  @Column({ type: 'json', nullable: true })
  rooms: QuoteRoomInput[];

  @Column({ type: 'json', nullable: true })
  lineItems: QuoteLineItem[];

  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId: string | null;

  /** Scope-addition quote for an existing project (change order). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  parentProjectId: string | null;

  @Column({ type: 'int', nullable: true })
  changeOrderNumber: number | null;

  /** When rooms/pieces from this change order were merged into the project. */
  @Column({ type: 'datetime', nullable: true })
  appliedAt: Date | null;

  @Column({
    type: 'enum',
    enum: ChangeOrderType,
    nullable: true,
  })
  changeOrderType: ChangeOrderType | null;

  /** Pieces and rooms to remove when a reduction change order is applied. */
  @Column({ type: 'json', nullable: true })
  removalTargets: QuoteRemovalTargets | null;

  /** Selected credit line items for scope reduction quotes. */
  @Column({ type: 'json', nullable: true })
  creditLineItems: QuoteLineItem[] | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
