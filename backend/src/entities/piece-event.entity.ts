import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ConditionRating, PieceStage } from '../common/enums';
import { Piece } from './piece.entity';

@Entity('piece_events')
export class PieceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Piece, (piece) => piece.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pieceId' })
  piece: Piece;

  @Column()
  pieceId: string;

  @Column({ type: 'enum', enum: PieceStage })
  stage: PieceStage;

  @Column({ type: 'enum', enum: ConditionRating })
  condition: ConditionRating;

  @Column()
  location: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column({ nullable: true })
  photoUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
