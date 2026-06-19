import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_label_pdfs')
export class ProjectLabelPdf {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 64 })
  templateId: string;

  @Column({ type: 'int' })
  pieceCount: number;

  @Column({ type: 'varchar', length: 32 })
  jobNumber: string;

  @Column({ type: 'varchar', length: 64 })
  printedAt: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
