import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../common/roles';

export enum RecordType {
  QUOTE = 'quote',
  PROJECT = 'project',
}

export enum RecordChangeAction {
  UPDATED = 'updated',
  QUOTE_SENT = 'quote_sent',
}

export interface RecordFieldChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

@Entity('record_changes')
export class RecordChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RecordType })
  recordType: RecordType;

  @Column({ type: 'uuid' })
  recordId: string;

  @Column({ type: 'enum', enum: RecordChangeAction })
  action: RecordChangeAction;

  @Column({ type: 'uuid' })
  actorUserId: string;

  @Column({ type: 'varchar', length: 255 })
  actorName: string;

  @Column({ type: 'varchar', length: 64 })
  actorRole: string;

  @Column({ type: 'json' })
  changes: RecordFieldChange[];

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
