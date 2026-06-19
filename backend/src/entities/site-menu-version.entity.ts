import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('site_menu_versions')
export class SiteMenuVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 36 })
  changedByUserId: string;

  @Column({ type: 'varchar', length: 255 })
  changedByName: string;

  @Column({ type: 'text', nullable: true })
  changeNote: string | null;

  @Column({ type: 'boolean', default: false })
  isRestore: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  restoredFromVersionId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
