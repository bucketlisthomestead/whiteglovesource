import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PhotoMilestone } from '../common/signoff';
import { Piece } from './piece.entity';

@Entity('piece_stage_photos')
@Unique(['pieceId', 'milestone'])
export class PieceStagePhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Piece, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pieceId' })
  piece: Piece;

  @Column()
  pieceId: string;

  @Column({ type: 'enum', enum: PhotoMilestone })
  milestone: PhotoMilestone;

  @Column()
  photoUrl: string;

  @Column({ nullable: true })
  capturedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  capturedAt: Date;
}
