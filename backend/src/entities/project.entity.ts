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
import { ProjectStatus, InstallDestination } from '../common/enums';
import { Client } from './client.entity';
import { Designer } from './designer.entity';
import { Room } from './room.entity';
import { Piece } from './piece.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  status: ProjectStatus;

  @Column()
  propertyAddress: string;

  @Column({ nullable: true })
  propertyCity: string;

  @Column({ type: 'date', nullable: true })
  targetInstallDate: string;

  @Column({ type: 'date', nullable: true })
  planningCompletedDate: string;

  @Column({ type: 'date', nullable: true })
  pickupWindowStart: string;

  @Column({ type: 'date', nullable: true })
  pickupWindowEnd: string;

  @Column({ type: 'text', nullable: true })
  stagingPlanOverview: string;

  @Column({
    type: 'enum',
    enum: InstallDestination,
    default: InstallDestination.FINAL_SITE,
  })
  primaryInstallDestination: InstallDestination;

  @Column({ nullable: true })
  showroomAddress: string;

  @Column({ default: false })
  isDemo: boolean;

  @Column({ default: true })
  isActive: boolean;

  /** Locked pricing snapshot from quote or business defaults at project creation */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 3.5 })
  mileRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 350 })
  projectBaseFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 175 })
  additionalPickupSurcharge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 750 })
  minimumQuote: number;

  @ManyToOne(() => Designer, (designer) => designer.projects, { eager: true })
  @JoinColumn({ name: 'designerId' })
  designer: Designer;

  @Column()
  designerId: string;

  @ManyToOne(() => Client, (client) => client.projects, { eager: true })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: string;

  @OneToMany(() => Room, (room) => room.project)
  rooms: Room[];

  @OneToMany(() => Piece, (piece) => piece.project)
  pieces: Piece[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
