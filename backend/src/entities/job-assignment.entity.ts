import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CrewRole } from '../common/enums';
import { ScheduledJob } from './scheduled-job.entity';
import { CrewMember } from './crew-member.entity';

@Entity('job_assignments')
export class JobAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScheduledJob, (job) => job.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'jobId' })
  job: ScheduledJob;

  @Column()
  jobId: string;

  @ManyToOne(() => CrewMember, { eager: true })
  @JoinColumn({ name: 'crewMemberId' })
  crewMember: CrewMember;

  @Column()
  crewMemberId: string;

  @Column({ type: 'enum', enum: CrewRole })
  assignmentRole: CrewRole;
}
