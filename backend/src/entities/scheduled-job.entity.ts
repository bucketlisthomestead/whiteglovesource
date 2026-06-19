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
import { JobType, JobStatus, InstallDestination } from '../common/enums';
import { Project } from './project.entity';
import { PickupLocation } from './pickup-location.entity';
import { JobAssignment } from './job-assignment.entity';

@Entity('scheduled_jobs')
export class ScheduledJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: JobType })
  jobType: JobType;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.SCHEDULED })
  status: JobStatus;

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ nullable: true })
  startTime: string;

  @Column({ nullable: true })
  endTime: string;

  @Column()
  locationAddress: string;

  @Column({ nullable: true })
  locationCity: string;

  @Column({
    type: 'enum',
    enum: InstallDestination,
    nullable: true,
  })
  destinationType: InstallDestination | null;

  @Column({ type: 'simple-json', nullable: true })
  pieceIds: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => PickupLocation, { nullable: true })
  @JoinColumn({ name: 'pickupLocationId' })
  pickupLocation: PickupLocation | null;

  @Column({ type: 'uuid', nullable: true })
  pickupLocationId: string | null;

  @OneToMany(() => JobAssignment, (a) => a.job)
  assignments: JobAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
