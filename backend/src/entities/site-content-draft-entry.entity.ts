import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SiteContentDraft } from './site-content-draft.entity';

@Entity('site_content_draft_entries')
@Unique(['draftId', 'contentKey'])
export class SiteContentDraftEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SiteContentDraft, (draft) => draft.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'draftId' })
  draft: SiteContentDraft;

  @Column({ type: 'uuid' })
  draftId: string;

  @Column({ type: 'varchar', length: 64 })
  contentKey: string;

  @Column({ type: 'text' })
  content: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
