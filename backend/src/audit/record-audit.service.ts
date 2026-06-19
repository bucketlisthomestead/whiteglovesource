import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RecordChange,
  RecordChangeAction,
  RecordFieldChange,
  RecordType,
} from '../entities/record-change.entity';
import { User } from '../entities/user.entity';
import {
  QuoteStatus,
  StorageType,
  ProjectStatus,
  PROJECT_STATUS_LABELS,
} from '../common/enums';

const QUOTE_FIELD_LABELS: Record<string, string> = {
  contactName: 'Contact name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  serviceType: 'Service type',
  projectDescription: 'Project description',
  propertyAddress: 'Install address',
  pickupAddress: 'Pickup address',
  preferredDate: 'Preferred date',
  estimatedPieces: 'Estimated pieces',
  quotedAmount: 'Quoted amount',
  internalNotes: 'Internal notes',
  status: 'Status',
  milesToStorage: 'Miles to warehouse',
  milesToInstall: 'Miles to install',
  storageMonths: 'Storage months',
  storageType: 'Storage type',
  pickupLocationCount: 'Pickup locations',
  mileRate: 'Mile rate ($/mi)',
  projectBaseFee: 'Coordination fee ($)',
  additionalPickupSurcharge: 'Extra pickup surcharge ($)',
  minimumQuote: 'Minimum quote ($)',
  isActive: 'Active',
};

const PROJECT_FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  mileRate: 'Mile rate ($/mi)',
  projectBaseFee: 'Coordination fee ($)',
  additionalPickupSurcharge: 'Extra pickup surcharge ($)',
  minimumQuote: 'Minimum quote ($)',
  isActive: 'Active',
};

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.LEAD]: 'Lead',
  [QuoteStatus.PENDING]: 'Pending review',
  [QuoteStatus.REVIEWING]: 'Under review',
  [QuoteStatus.QUOTED]: 'Quoted',
  [QuoteStatus.ACCEPTED]: 'Accepted',
  [QuoteStatus.DECLINED]: 'Declined',
};

const NUMERIC_QUOTE_FIELDS = new Set([
  'quotedAmount',
  'mileRate',
  'projectBaseFee',
  'additionalPickupSurcharge',
  'minimumQuote',
  'milesToStorage',
  'milesToInstall',
  'storageMonths',
  'pickupLocationCount',
  'estimatedPieces',
]);

const NUMERIC_PROJECT_FIELDS = new Set([
  'mileRate',
  'projectBaseFee',
  'additionalPickupSurcharge',
  'minimumQuote',
]);

const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  [StorageType.STANDARD_CLIMATE]: 'Standard climate',
  [StorageType.PREMIUM_CLIMATE]: 'Premium climate',
  [StorageType.SHORT_TERM]: 'Short term',
};

@Injectable()
export class RecordAuditService {
  constructor(
    @InjectRepository(RecordChange)
    private readonly changeRepo: Repository<RecordChange>,
  ) {}

  listForQuote(quoteId: string) {
    return this.changeRepo.find({
      where: { recordType: RecordType.QUOTE, recordId: quoteId },
      order: { createdAt: 'DESC' },
    });
  }

  listForProject(projectId: string) {
    return this.changeRepo.find({
      where: { recordType: RecordType.PROJECT, recordId: projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async recordQuoteUpdate(
    user: User,
    quoteId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    const changes = this.diffFields(
      before,
      after,
      QUOTE_FIELD_LABELS,
      Object.keys(QUOTE_FIELD_LABELS),
    );
    if (changes.length === 0) return null;
    return this.save(
      user,
      RecordType.QUOTE,
      quoteId,
      RecordChangeAction.UPDATED,
      changes,
    );
  }

  async recordQuoteSent(
    user: User,
    quoteId: string,
    changes: RecordFieldChange[],
  ) {
    const meaningful = changes.filter((c) => c.from !== c.to);
    return this.save(
      user,
      RecordType.QUOTE,
      quoteId,
      RecordChangeAction.QUOTE_SENT,
      meaningful,
      'Quote emailed to client for approval',
    );
  }

  diffQuoteFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields?: string[],
  ): RecordFieldChange[] {
    const keys = fields ?? Object.keys(QUOTE_FIELD_LABELS);
    return this.diffFields(before, after, QUOTE_FIELD_LABELS, keys);
  }

  async recordProjectUpdate(
    user: User,
    projectId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    const changes = this.diffFields(
      before,
      after,
      PROJECT_FIELD_LABELS,
      Object.keys(PROJECT_FIELD_LABELS),
    );
    if (changes.length === 0) return null;
    return this.save(
      user,
      RecordType.PROJECT,
      projectId,
      RecordChangeAction.UPDATED,
      changes,
    );
  }

  async recordCustomChange(
    user: User,
    recordType: RecordType,
    recordId: string,
    action: RecordChangeAction,
    changes: RecordFieldChange[],
    summary?: string,
  ) {
    if (changes.length === 0) return null;
    return this.save(user, recordType, recordId, action, changes, summary);
  }

  private async save(
    user: User,
    recordType: RecordType,
    recordId: string,
    action: RecordChangeAction,
    changes: RecordFieldChange[],
    summary?: string,
  ) {
    return this.changeRepo.save(
      this.changeRepo.create({
        recordType,
        recordId,
        action,
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        changes,
        summary: summary ?? null,
      }),
    );
  }

  private diffFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    labels: Record<string, string>,
    fields: string[],
  ): RecordFieldChange[] {
    const changes: RecordFieldChange[] = [];
    for (const field of fields) {
      if (this.valuesEqual(field, before[field], after[field])) continue;

      const from = this.formatField(field, before[field]);
      const to = this.formatField(field, after[field]);
      if (from === to) continue;

      changes.push({ field, label: labels[field] ?? field, from, to });
    }
    return changes;
  }

  private normalizeForCompare(field: string, value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;
    if (field === 'isActive') return Boolean(value);
    if (field === 'status' || field === 'storageType') return value;
    if (NUMERIC_QUOTE_FIELDS.has(field) || NUMERIC_PROJECT_FIELDS.has(field)) {
      const n = Number(value);
      return Number.isNaN(n) ? String(value).trim() : n;
    }
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'bigint')
      return Number(value);
    return value;
  }

  private valuesEqual(field: string, before: unknown, after: unknown): boolean {
    const left = this.normalizeForCompare(field, before);
    const right = this.normalizeForCompare(field, after);
    if (typeof left === 'number' && typeof right === 'number') {
      return Math.abs(left - right) < 1e-9;
    }
    return left === right;
  }

  private formatField(field: string, value: unknown): string | null {
    const normalized = this.normalizeForCompare(field, value);
    if (normalized === null) return null;
    if (field === 'status') {
      return (
        PROJECT_STATUS_LABELS[normalized as ProjectStatus] ??
        QUOTE_STATUS_LABELS[normalized as QuoteStatus] ??
        String(normalized)
      );
    }
    if (field === 'storageType') {
      return (
        STORAGE_TYPE_LABELS[normalized as StorageType] ?? String(normalized)
      );
    }
    if (field === 'isActive') return normalized ? 'Yes' : 'No';
    if (typeof normalized === 'number') {
      return normalized.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(normalized);
  }

  quoteSnapshot(quote: {
    contactName: string;
    email: string;
    phone: string | null;
    company: string | null;
    serviceType: string;
    projectDescription: string;
    propertyAddress: string | null;
    pickupAddress: string | null;
    preferredDate: string | null;
    estimatedPieces: number | null;
    quotedAmount: number | null;
    internalNotes: string | null;
    status: QuoteStatus;
    milesToStorage: number;
    milesToInstall: number;
    storageMonths: number;
    storageType: StorageType;
    pickupLocationCount: number;
    mileRate: number | null;
    projectBaseFee: number | null;
    additionalPickupSurcharge: number | null;
    minimumQuote: number | null;
    isActive: boolean;
  }): Record<string, unknown> {
    return {
      contactName: quote.contactName,
      email: quote.email,
      phone: quote.phone,
      company: quote.company,
      serviceType: quote.serviceType,
      projectDescription: quote.projectDescription,
      propertyAddress: quote.propertyAddress,
      pickupAddress: quote.pickupAddress,
      preferredDate: quote.preferredDate,
      estimatedPieces: quote.estimatedPieces,
      quotedAmount:
        quote.quotedAmount != null ? Number(quote.quotedAmount) : null,
      internalNotes: quote.internalNotes,
      status: quote.status,
      milesToStorage: quote.milesToStorage,
      milesToInstall: quote.milesToInstall,
      storageMonths: quote.storageMonths,
      storageType: quote.storageType,
      pickupLocationCount: quote.pickupLocationCount,
      mileRate: quote.mileRate != null ? Number(quote.mileRate) : null,
      projectBaseFee:
        quote.projectBaseFee != null ? Number(quote.projectBaseFee) : null,
      additionalPickupSurcharge:
        quote.additionalPickupSurcharge != null
          ? Number(quote.additionalPickupSurcharge)
          : null,
      minimumQuote:
        quote.minimumQuote != null ? Number(quote.minimumQuote) : null,
      isActive: quote.isActive,
    };
  }

  projectSnapshot(project: {
    mileRate: number;
    projectBaseFee: number;
    additionalPickupSurcharge: number;
    minimumQuote: number;
    isActive: boolean;
    status: ProjectStatus;
  }) {
    return {
      status: project.status,
      mileRate: Number(project.mileRate),
      projectBaseFee: Number(project.projectBaseFee),
      additionalPickupSurcharge: Number(project.additionalPickupSurcharge),
      minimumQuote: Number(project.minimumQuote),
      isActive: project.isActive,
    };
  }
}
