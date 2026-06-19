import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PhasePaymentStatus, ProjectPhase } from '../common/enums';
import { Project } from './project.entity';

@Entity('project_phase_payments')
@Unique(['projectId', 'phase'])
export class ProjectPhasePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'varchar', length: 36 })
  projectId: string;

  @Column({ type: 'enum', enum: ProjectPhase })
  phase: ProjectPhase;

  @Column({
    type: 'enum',
    enum: PhasePaymentStatus,
    default: PhasePaymentStatus.NOT_DUE,
  })
  status: PhasePaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountExpected: string | null;

  @Column({ type: 'datetime', nullable: true })
  capturedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  capturedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  capturedByName: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
