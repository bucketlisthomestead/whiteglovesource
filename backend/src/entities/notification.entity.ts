import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  QUOTE_LEAD = 'quote_lead',
  QUOTE_SUBMITTED = 'quote_submitted',
  PROJECT_OPENED = 'project_opened',
  PROJECT_MESSAGE = 'project_message',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  link: string | null;

  @Column({ type: 'uuid', nullable: true })
  quoteId: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
