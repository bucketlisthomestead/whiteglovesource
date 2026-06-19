import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { QuoteRequest } from './quote-request.entity';

@Entity('contract_amendments')
export class ContractAmendment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => QuoteRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote: QuoteRequest;

  @Column({ type: 'uuid' })
  quoteId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'varchar', length: 512 })
  proposalStorageKey: string;

  @Column({ type: 'varchar', length: 255 })
  proposalFilename: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedAmount: number | null;

  @Column({ type: 'uuid', nullable: true })
  generatedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  generatedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
