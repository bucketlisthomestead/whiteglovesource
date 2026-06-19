import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ConditionRating,
  PieceStage,
  InstallDestination,
} from '../common/enums';
import { Project } from './project.entity';
import { Room } from './room.entity';
import { PieceEvent } from './piece-event.entity';
import { PickupLocation } from './pickup-location.entity';

@Entity('pieces')
export class Piece {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  vendor: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value: number;

  @Column({ type: 'enum', enum: PieceStage, default: PieceStage.RECEIVED })
  currentStage: PieceStage;

  @Column({
    type: 'enum',
    enum: ConditionRating,
    default: ConditionRating.EXCELLENT,
  })
  currentCondition: ConditionRating;

  @Column({ nullable: true })
  currentLocation: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ type: 'text', nullable: true })
  stagingNotes: string;

  @Column({
    type: 'enum',
    enum: InstallDestination,
    default: InstallDestination.FINAL_SITE,
  })
  installDestination: InstallDestination;

  @ManyToOne(() => PickupLocation, { nullable: true, eager: true })
  @JoinColumn({ name: 'pickupLocationId' })
  pickupLocation: PickupLocation | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  pickupLocationId: string | null;

  @ManyToOne(() => Project, (project) => project.pieces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => Room, (room) => room.pieces, { nullable: true, eager: true })
  @JoinColumn({ name: 'roomId' })
  room: Room | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  roomId: string | null;

  /** Catalogue item this piece was created from (for scope reduction pricing). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  catalogItemId: string | null;

  /** Unique token encoded in label QR codes for scan/check-in. */
  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  scanToken: string | null;

  @OneToMany(() => PieceEvent, (event) => event.piece)
  events: PieceEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
