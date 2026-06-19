import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PhotoMilestone, SignoffType, SignerRole } from '../common/signoff';
import { ProjectPhase } from '../common/enums';
import { Project } from './project.entity';
import { Piece } from './piece.entity';

@Entity('signoffs')
export class Signoff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => Piece, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pieceId' })
  piece: Piece | null;

  @Column({ type: 'uuid', nullable: true })
  pieceId: string | null;

  @Column({ type: 'enum', enum: SignoffType })
  signoffType: SignoffType;

  @Column({ type: 'enum', enum: SignerRole })
  signerRole: SignerRole;

  @Column()
  signerName: string;

  @Column({ type: 'uuid', nullable: true })
  signerUserId: string;

  @Column({ type: 'enum', enum: PhotoMilestone, nullable: true })
  milestone: PhotoMilestone | null;

  @Column({ type: 'enum', enum: ProjectPhase, nullable: true })
  phase: ProjectPhase | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  signedAt: Date;
}
