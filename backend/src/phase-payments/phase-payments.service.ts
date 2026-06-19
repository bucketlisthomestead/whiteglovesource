import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PHASE_LABELS,
  PHASE_ORDER,
  PHASE_PAYMENT_STATUS_LABELS,
  PhasePaymentStatus,
  ProjectPhase,
} from '../common/enums';
import { UpdatePhasePaymentDto } from '../common/phase-payment.dto';
import { ProjectPhasePayment } from '../entities/project-phase-payment.entity';
import { User } from '../entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { RecordAuditService } from '../audit/record-audit.service';
import {
  RecordChangeAction,
  RecordType,
} from '../entities/record-change.entity';

export interface PhasePaymentDto {
  id: string | null;
  projectId: string;
  phase: ProjectPhase;
  status: PhasePaymentStatus;
  amountExpected: number | null;
  capturedAt: string | null;
  capturedByUserId: string | null;
  capturedByName: string | null;
  note: string | null;
  updatedAt: string | null;
}

@Injectable()
export class PhasePaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PhasePaymentsService.name);

  constructor(
    @InjectRepository(ProjectPhasePayment)
    private readonly paymentRepo: Repository<ProjectPhasePayment>,
    private readonly projectsService: ProjectsService,
    private readonly auditService: RecordAuditService,
  ) {}

  async onModuleInit() {
    await this.migrateLegacyContractPayments();
  }

  async listForProject(
    projectId: string,
    user: User,
  ): Promise<PhasePaymentDto[]> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const rows = await this.paymentRepo.find({ where: { projectId } });
    const byPhase = new Map(rows.map((row) => [row.phase, row]));
    return PHASE_ORDER.map((phase) =>
      this.serialize(byPhase.get(phase), projectId, phase),
    );
  }

  async updatePhase(
    projectId: string,
    phase: ProjectPhase,
    dto: UpdatePhasePaymentDto,
    user: User,
  ): Promise<PhasePaymentDto> {
    await this.projectsService.assertProjectAccess(projectId, user);
    if (!PHASE_ORDER.includes(phase)) {
      throw new BadRequestException('Invalid project phase');
    }

    let row = await this.paymentRepo.findOne({ where: { projectId, phase } });
    const before = row
      ? this.snapshot(row)
      : this.defaultSnapshot(projectId, phase);

    if (!row) {
      row = this.paymentRepo.create({ projectId, phase });
    }

    row.status = dto.status;
    if (dto.amountExpected !== undefined) {
      row.amountExpected =
        dto.amountExpected == null
          ? null
          : String(Number(dto.amountExpected).toFixed(2));
    }
    row.note = dto.note?.trim() || null;

    if (dto.status === PhasePaymentStatus.CAPTURED) {
      if (!row.capturedAt) {
        row.capturedAt = new Date();
        row.capturedByUserId = user.id;
        row.capturedByName = user.name;
      }
    } else {
      row.capturedAt = null;
      row.capturedByUserId = null;
      row.capturedByName = null;
    }

    const saved = await this.paymentRepo.save(row);
    const after = this.snapshot(saved);
    await this.auditService.recordCustomChange(
      user,
      RecordType.PROJECT,
      projectId,
      RecordChangeAction.UPDATED,
      this.diffPhasePayment(before, after, phase),
      `Phase payment updated — ${PHASE_LABELS[phase]}`,
    );

    return this.serialize(saved, projectId, phase);
  }

  private serialize(
    row: ProjectPhasePayment | undefined,
    projectId: string,
    phase: ProjectPhase,
  ): PhasePaymentDto {
    if (!row) {
      return {
        id: null,
        projectId,
        phase,
        status: PhasePaymentStatus.NOT_DUE,
        amountExpected: null,
        capturedAt: null,
        capturedByUserId: null,
        capturedByName: null,
        note: null,
        updatedAt: null,
      };
    }

    return {
      id: row.id,
      projectId: row.projectId,
      phase: row.phase,
      status: row.status,
      amountExpected:
        row.amountExpected != null ? Number(row.amountExpected) : null,
      capturedAt: row.capturedAt?.toISOString() ?? null,
      capturedByUserId: row.capturedByUserId,
      capturedByName: row.capturedByName,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private snapshot(row: ProjectPhasePayment) {
    return {
      status: row.status,
      amountExpected:
        row.amountExpected != null ? Number(row.amountExpected) : null,
      capturedAt: row.capturedAt?.toISOString() ?? null,
      capturedByName: row.capturedByName,
      note: row.note,
    };
  }

  private defaultSnapshot(projectId: string, phase: ProjectPhase) {
    return {
      status: PhasePaymentStatus.NOT_DUE,
      amountExpected: null,
      capturedAt: null,
      capturedByName: null,
      note: null,
      projectId,
      phase,
    };
  }

  private diffPhasePayment(
    before:
      | ReturnType<PhasePaymentsService['snapshot']>
      | ReturnType<PhasePaymentsService['defaultSnapshot']>,
    after: ReturnType<PhasePaymentsService['snapshot']>,
    phase: ProjectPhase,
  ) {
    const phaseLabel = PHASE_LABELS[phase];
    const changes: {
      field: string;
      label: string;
      from: string | null;
      to: string | null;
    }[] = [];
    const fields: {
      key: keyof typeof before;
      label: string;
      format?: (v: unknown) => string | null;
    }[] = [
      {
        key: 'status',
        label: 'Payment status',
        format: (v) =>
          PHASE_PAYMENT_STATUS_LABELS[v as PhasePaymentStatus] ?? String(v),
      },
      {
        key: 'amountExpected',
        label: 'Amount expected',
        format: (v) => (v == null ? null : `$${Number(v).toFixed(2)}`),
      },
      {
        key: 'capturedAt',
        label: 'Captured date',
        format: (v) => (v ? String(v).slice(0, 10) : null),
      },
      { key: 'capturedByName', label: 'Captured by' },
      { key: 'note', label: 'Note' },
    ];

    for (const { key, label, format } of fields) {
      const fromVal = before[key];
      const toVal = after[key];
      const from = format
        ? format(fromVal)
        : fromVal == null
          ? null
          : String(fromVal);
      const to = format ? format(toVal) : toVal == null ? null : String(toVal);
      if (from !== to) {
        changes.push({
          field: `${phase}.${String(key)}`,
          label: `${phaseLabel} — ${label}`,
          from,
          to,
        });
      }
    }

    return changes;
  }

  private async migrateLegacyContractPayments() {
    const qr = this.paymentRepo.manager.connection.createQueryRunner();
    try {
      const table = await qr.getTable('contract_proposals');
      if (!table) return;

      if (table.columns.some((column) => column.name === 'paymentByPhase')) {
        const rows: Array<{
          projectId: string;
          paymentByPhase:
            | string
            | Record<
                string,
                { captured?: boolean; capturedAt?: string; note?: string }
              >
            | null;
        }> = await qr.query(
          `SELECT projectId, paymentByPhase FROM contract_proposals WHERE paymentByPhase IS NOT NULL`,
        );

        for (const row of rows) {
          const raw =
            typeof row.paymentByPhase === 'string'
              ? (JSON.parse(row.paymentByPhase) as Record<
                  string,
                  { captured?: boolean; capturedAt?: string; note?: string }
                >)
              : row.paymentByPhase;
          if (!raw) continue;

          for (const phase of PHASE_ORDER) {
            const entry = raw[phase];
            if (!entry?.captured) continue;

            const existing = await this.paymentRepo.findOne({
              where: { projectId: row.projectId, phase },
            });
            if (existing) continue;

            await this.paymentRepo.save(
              this.paymentRepo.create({
                projectId: row.projectId,
                phase,
                status: PhasePaymentStatus.CAPTURED,
                capturedAt: entry.capturedAt
                  ? new Date(entry.capturedAt)
                  : new Date(),
                note: entry.note?.trim() || null,
              }),
            );
          }
        }

        await qr.query(
          `ALTER TABLE contract_proposals DROP COLUMN paymentByPhase`,
        );
        this.logger.log(
          'Migrated contract paymentByPhase JSON to project_phase_payments',
        );
      }

      if (table.columns.some((column) => column.name === 'paymentCaptured')) {
        const rows: Array<{
          projectId: string;
          paymentCapturedAt: Date | string | null;
          paymentNote: string | null;
        }> = await qr.query(
          `SELECT projectId, paymentCapturedAt, paymentNote FROM contract_proposals WHERE paymentCaptured = 1`,
        );

        for (const row of rows) {
          const existing = await this.paymentRepo.findOne({
            where: { projectId: row.projectId, phase: ProjectPhase.PLANNING },
          });
          if (existing) continue;

          await this.paymentRepo.save(
            this.paymentRepo.create({
              projectId: row.projectId,
              phase: ProjectPhase.PLANNING,
              status: PhasePaymentStatus.CAPTURED,
              capturedAt: row.paymentCapturedAt
                ? new Date(row.paymentCapturedAt)
                : new Date(),
              note: row.paymentNote?.trim() || null,
            }),
          );
        }

        await qr.query(
          `ALTER TABLE contract_proposals DROP COLUMN paymentCaptured`,
        );
        await qr.query(
          `ALTER TABLE contract_proposals DROP COLUMN paymentCapturedAt`,
        );
        await qr.query(
          `ALTER TABLE contract_proposals DROP COLUMN paymentNote`,
        );
        this.logger.log(
          'Migrated legacy paymentCaptured fields to project_phase_payments',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Phase payment migration skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await qr.release();
    }
  }
}
