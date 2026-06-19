import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SiteContentDraftEntry } from './site-content-draft-entry.entity';
import { SiteContentFeedback } from './site-content-feedback.entity';

export enum SiteContentDraftStatus {
  ACTIVE = 'active',
  PUBLISHED = 'published',
  DISCARDED = 'discarded',
}

@Entity('site_content_drafts')
export class SiteContentDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SiteContentDraftStatus,
    default: SiteContentDraftStatus.ACTIVE,
  })
  status: SiteContentDraftStatus;

  @Column({ type: 'varchar', length: 36 })
  createdByUserId: string;

  @Column({ type: 'varchar', length: 255 })
  createdByName: string;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  publishedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publishedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SiteContentDraftEntry, (entry) => entry.draft)
  entries: SiteContentDraftEntry[];

  @OneToMany(() => SiteContentFeedback, (feedback) => feedback.draft)
  feedback: SiteContentFeedback[];
}
