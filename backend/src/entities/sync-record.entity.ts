import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sync_records')
export class SyncRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clientMutationId: string;

  @Column()
  userId: string;

  @Column()
  mutationType: string;

  @CreateDateColumn()
  processedAt: Date;
}
