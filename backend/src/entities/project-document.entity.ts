import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectPhase } from '../common/enums';
import { Project } from './project.entity';

export enum ProjectDocumentType {
  INVENTORY = 'inventory',
  STATUS_FULL = 'status_full',
  STATUS_PHASE = 'status_phase',
}

@Entity('project_documents')
export class ProjectDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'enum', enum: ProjectDocumentType })
  documentType: ProjectDocumentType;

  @Column({ type: 'enum', enum: ProjectPhase, nullable: true })
  phase: ProjectPhase | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  /** Object storage key (S3 key or local relative path under storage/) */
  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  generatedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  generatedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
