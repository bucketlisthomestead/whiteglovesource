import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('site_content_versions')
export class SiteContentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  contentKey: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid' })
  changedByUserId: string;

  @Column({ type: 'varchar', length: 255 })
  changedByName: string;

  @Column({ type: 'text', nullable: true })
  changeNote: string | null;

  @Column({ type: 'boolean', default: false })
  isRestore: boolean;

  @Column({ type: 'uuid', nullable: true })
  restoredFromVersionId: string | null;

  @Column({ type: 'boolean', default: false })
  isPublish: boolean;

  @Column({ type: 'uuid', nullable: true })
  draftId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
