import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../common/roles';
import { Project } from './project.entity';

@Entity('project_messages')
export class ProjectMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'varchar', length: 36 })
  projectId: string;

  @Column({ type: 'varchar', length: 36 })
  authorUserId: string;

  @Column({ type: 'varchar', length: 255 })
  authorName: string;

  @Column({ type: 'varchar', length: 64 })
  authorRole: string;

  @Column({ type: 'text' })
  body: string;

  /** Admin-only notes — hidden from designers and clients */
  @Column({ type: 'boolean', default: false })
  isInternal: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
