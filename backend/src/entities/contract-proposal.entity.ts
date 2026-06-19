import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

export enum ContractProposalStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  SIGNED = 'signed',
}

export type ContractSignatureEntry = {
  name: string;
  signedAt: string;
  userId?: string;
  signatureStorageKey?: string;
};

export type ContractSignatureMetadata = {
  admin?: ContractSignatureEntry;
  client?: ContractSignatureEntry;
};

@Entity('contract_proposals')
export class ContractProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'varchar', length: 36, unique: true })
  projectId: string;

  @Column({
    type: 'enum',
    enum: ContractProposalStatus,
    default: ContractProposalStatus.DRAFT,
  })
  status: ContractProposalStatus;

  @Column({ type: 'varchar', length: 512, nullable: true })
  proposalStorageKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proposalFilename: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  signedUploadStorageKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signedUploadFilename: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  signedUploadMimeType: string | null;

  @Column({ type: 'json', nullable: true })
  signatureMetadata: ContractSignatureMetadata | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  generatedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  generatedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
