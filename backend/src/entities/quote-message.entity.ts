import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../common/roles';
import { QuoteRequest } from './quote-request.entity';

@Entity('quote_messages')
export class QuoteMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QuoteRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote: QuoteRequest;

  @Column({ type: 'varchar', length: 36 })
  quoteId: string;

  @Column({ type: 'varchar', length: 36 })
  authorUserId: string;

  @Column({ type: 'varchar', length: 255 })
  authorName: string;

  @Column({ type: 'varchar', length: 64 })
  authorRole: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  isInternal: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
