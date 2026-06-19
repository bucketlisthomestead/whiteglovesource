import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SiteContentDraft } from './site-content-draft.entity';

@Entity('site_content_feedback')
export class SiteContentFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SiteContentDraft, (draft) => draft.feedback, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'draftId' })
  draft: SiteContentDraft;

  @Column({ type: 'varchar', length: 36 })
  draftId: string;

  /** Null means overall draft feedback */
  @Column({ type: 'varchar', length: 64, nullable: true })
  contentKey: string | null;

  @Column({ type: 'varchar', length: 36 })
  authorUserId: string;

  @Column({ type: 'varchar', length: 255 })
  authorName: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
