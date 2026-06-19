import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { PieceEvent } from '../entities/piece-event.entity';
import { PickupLocation } from '../entities/pickup-location.entity';
import { ScheduledJob } from '../entities/scheduled-job.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { ProjectDocument } from '../entities/project-document.entity';
import { ProjectMessage } from '../entities/project-message.entity';
import { CreateProjectMessageDto } from '../common/project-message.dto';
import {
  CONDITION_LABELS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  PHASE_LABELS,
  QuoteStatus,
  STAGE_LABELS,
} from '../common/enums';
import {
  PHOTO_MILESTONE_LABELS,
  SIGNER_ROLE_LABELS,
  SignoffType,
} from '../common/signoff';
import { SignoffsService } from '../signoffs/signoffs.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/roles';
import { ProjectsService } from './projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordAuditService } from '../audit/record-audit.service';

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.LEAD]: 'Lead',
  [QuoteStatus.PENDING]: 'Pending Review',
  [QuoteStatus.REVIEWING]: 'Under Review',
  [QuoteStatus.QUOTED]: 'Quoted',
  [QuoteStatus.ACCEPTED]: 'Accepted',
  [QuoteStatus.DECLINED]: 'Declined',
};

export type ProjectActivityCategory =
  | 'origin'
  | 'approval'
  | 'update'
  | 'schedule'
  | 'document'
  | 'communication';

export type ProjectActivityType =
  | 'project_created'
  | 'quote'
  | 'piece_update'
  | 'signoff'
  | 'stage_photo'
  | 'document'
  | 'pickup'
  | 'job'
  | 'message'
  | 'record_edit';

export interface ProjectActivityEntry {
  id: string;
  type: ProjectActivityType;
  category: ProjectActivityCategory;
  occurredAt: string;
  title: string;
  summary?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ProjectAuditService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    @InjectRepository(PieceEvent)
    private readonly eventRepo: Repository<PieceEvent>,
    @InjectRepository(PickupLocation)
    private readonly pickupRepo: Repository<PickupLocation>,
    @InjectRepository(ScheduledJob)
    private readonly jobRepo: Repository<ScheduledJob>,
    @InjectRepository(QuoteRequest)
    private readonly quoteRepo: Repository<QuoteRequest>,
    @InjectRepository(ProjectDocument)
    private readonly documentRepo: Repository<ProjectDocument>,
    @InjectRepository(ProjectMessage)
    private readonly messageRepo: Repository<ProjectMessage>,
    private readonly signoffsService: SignoffsService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly recordAudit: RecordAuditService,
  ) {}

  async getLinkedQuote(projectId: string, user?: User) {
    await this.projectsService.assertProjectAccess(projectId, user);
    const quote = await this.quoteRepo.findOne({ where: { projectId } });
    if (!quote) return null;
    return this.serializeQuote(quote, user);
  }

  async getMessages(projectId: string, user: User) {
    await this.projectsService.assertProjectAccess(projectId, user);
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.projectId = :projectId', { projectId })
      .orderBy('m.createdAt', 'ASC');

    if (user.role !== UserRole.ADMIN) {
      qb.andWhere('m.isInternal = false');
    }

    const messages = await qb.getMany();
    return messages.map((m) => this.serializeMessage(m));
  }

  async createMessage(
    projectId: string,
    user: User,
    dto: CreateProjectMessageDto,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);
    const body = dto.body.trim();
    if (!body) throw new ForbiddenException('Message cannot be empty');

    const isInternal = user.role === UserRole.ADMIN && dto.isInternal === true;
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        projectId,
        authorUserId: user.id,
        authorName: user.name,
        authorRole: user.role,
        body,
        isInternal,
      }),
    );
    await this.notificationsService
      .notifyProjectMessage(project, user, body, isInternal)
      .catch(() => {});
    return this.serializeMessage(saved);
  }

  async getActivity(
    projectId: string,
    user?: User,
  ): Promise<ProjectActivityEntry[]> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const [
      pieces,
      events,
      signoffs,
      stagePhotos,
      documents,
      pickups,
      jobs,
      messages,
      quote,
      recordChanges,
    ] = await Promise.all([
      this.pieceRepo.find({
        where: { projectId },
        select: { id: true, name: true },
      }),
      this.eventRepo
        .createQueryBuilder('event')
        .innerJoin('event.piece', 'piece')
        .where('piece.projectId = :projectId', { projectId })
        .getMany(),
      this.signoffsService.findByProject(projectId),
      this.signoffsService.findStagePhotosByProject(projectId),
      this.documentRepo.find({
        where: { projectId },
        order: { createdAt: 'DESC' },
      }),
      this.pickupRepo.find({ where: { projectId } }),
      this.jobRepo.find({
        where: { projectId },
        relations: { pickupLocation: true },
      }),
      this.getMessagesForActivity(projectId, user),
      this.quoteRepo.findOne({ where: { projectId } }),
      this.recordAudit.listForProject(projectId),
    ]);

    const pieceNames = new Map(pieces.map((p) => [p.id, p.name]));
    const entries: ProjectActivityEntry[] = [];

    entries.push({
      id: `project-${project.id}`,
      type: 'project_created',
      category: 'origin',
      occurredAt: project.createdAt.toISOString(),
      title: 'Project created',
      summary: project.name,
    });

    if (quote) {
      entries.push({
        id: `quote-${quote.id}-submitted`,
        type: 'quote',
        category: 'origin',
        occurredAt: quote.createdAt.toISOString(),
        title: 'Quote submitted',
        summary: `${quote.contactName} · ${QUOTE_STATUS_LABELS[quote.status]}`,
        metadata: { quoteId: quote.id, status: quote.status },
      });

      if (
        quote.quotedAmount != null &&
        [QuoteStatus.QUOTED, QuoteStatus.ACCEPTED].includes(quote.status)
      ) {
        entries.push({
          id: `quote-${quote.id}-sent`,
          type: 'quote',
          category: 'origin',
          occurredAt: quote.updatedAt.toISOString(),
          title: 'Quote sent to client',
          summary:
            quote.quotedAmount != null
              ? `Quoted amount: $${Number(quote.quotedAmount).toFixed(2)}`
              : undefined,
          metadata: { quoteId: quote.id, quotedAmount: quote.quotedAmount },
        });
      }

      if (quote.projectId) {
        entries.push({
          id: `quote-${quote.id}-accepted`,
          type: 'quote',
          category: 'origin',
          occurredAt: project.createdAt.toISOString(),
          title: 'Quote accepted — project opened',
          summary: 'Operations project created from quote',
          metadata: { quoteId: quote.id },
        });
      }
    }

    for (const event of events) {
      const pieceName = pieceNames.get(event.pieceId) || 'Piece';
      entries.push({
        id: `event-${event.id}`,
        type: 'piece_update',
        category: 'update',
        occurredAt: event.createdAt.toISOString(),
        title: `${pieceName} updated`,
        summary: `${STAGE_LABELS[event.stage]} · ${CONDITION_LABELS[event.condition]} · ${event.location}`,
        actor: event.verifiedBy || undefined,
        metadata: {
          pieceId: event.pieceId,
          pieceName,
          stage: event.stage,
          condition: event.condition,
          notes: event.notes,
          hasPhoto: !!event.photoUrl,
        },
      });
    }

    for (const signoff of signoffs) {
      const pieceName = signoff.pieceId
        ? pieceNames.get(signoff.pieceId)
        : null;
      let title = 'Signoff recorded';
      let summary = `${SIGNER_ROLE_LABELS[signoff.signerRole]}: ${signoff.signerName}`;

      if (signoff.signoffType === SignoffType.INVENTORY && signoff.phase) {
        title = `${PHASE_LABELS[signoff.phase]} inventory signoff`;
      } else if (
        signoff.signoffType === SignoffType.MILESTONE &&
        signoff.milestone
      ) {
        title = pieceName
          ? `${pieceName} — ${PHOTO_MILESTONE_LABELS[signoff.milestone]} signoff`
          : `${PHOTO_MILESTONE_LABELS[signoff.milestone]} milestone signoff`;
      } else if (signoff.signoffType === SignoffType.PIECE && pieceName) {
        title = `${pieceName} signoff`;
      }

      if (signoff.notes) summary += ` · ${signoff.notes}`;

      entries.push({
        id: `signoff-${signoff.id}`,
        type: 'signoff',
        category: 'approval',
        occurredAt: signoff.signedAt.toISOString(),
        title,
        summary,
        actor: signoff.signerName,
        metadata: {
          signoffType: signoff.signoffType,
          phase: signoff.phase,
          milestone: signoff.milestone,
          pieceId: signoff.pieceId,
        },
      });
    }

    for (const photo of stagePhotos) {
      const pieceName = pieceNames.get(photo.pieceId) || 'Piece';
      entries.push({
        id: `photo-${photo.id}`,
        type: 'stage_photo',
        category: 'update',
        occurredAt: photo.capturedAt.toISOString(),
        title: `${pieceName} — ${PHOTO_MILESTONE_LABELS[photo.milestone]} photo`,
        summary: photo.notes || undefined,
        actor: photo.capturedBy || undefined,
        metadata: {
          pieceId: photo.pieceId,
          milestone: photo.milestone,
          photoUrl: photo.photoUrl,
        },
      });
    }

    for (const doc of documents) {
      entries.push({
        id: `doc-${doc.id}`,
        type: 'document',
        category: 'document',
        occurredAt: doc.createdAt.toISOString(),
        title: `PDF saved — ${doc.title}`,
        summary: doc.note || undefined,
        actor: doc.generatedByName || undefined,
        metadata: {
          documentId: doc.id,
          documentType: doc.documentType,
          phase: doc.phase,
        },
      });
    }

    for (const pickup of pickups) {
      entries.push({
        id: `pickup-${pickup.id}`,
        type: 'pickup',
        category: 'schedule',
        occurredAt: pickup.createdAt.toISOString(),
        title: `Pickup location added — ${pickup.name}`,
        summary: [pickup.address, pickup.city].filter(Boolean).join(', '),
        metadata: { pickupLocationId: pickup.id, vendor: pickup.vendor },
      });
    }

    for (const job of jobs) {
      const pieceCount = job.pieceIds?.length ?? 0;
      entries.push({
        id: `job-${job.id}`,
        type: 'job',
        category: 'schedule',
        occurredAt: job.createdAt.toISOString(),
        title: `${JOB_TYPE_LABELS[job.jobType]} scheduled`,
        summary: [
          job.title,
          job.scheduledDate,
          job.startTime ? `@ ${job.startTime}` : null,
          `${JOB_STATUS_LABELS[job.status]}`,
          pieceCount ? `${pieceCount} piece(s)` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        metadata: {
          jobId: job.id,
          jobType: job.jobType,
          status: job.status,
          scheduledDate: job.scheduledDate,
          pickupLocation: job.pickupLocation?.name,
        },
      });
    }

    for (const message of messages) {
      entries.push({
        id: `message-${message.id}`,
        type: 'message',
        category: 'communication',
        occurredAt: message.createdAt.toISOString(),
        title: message.isInternal ? 'Internal team note' : 'Project message',
        summary:
          message.body.length > 160
            ? `${message.body.slice(0, 160)}…`
            : message.body,
        actor: message.authorName,
        metadata: {
          messageId: message.id,
          authorRole: message.authorRole,
          isInternal: message.isInternal,
        },
      });
    }

    for (const change of recordChanges) {
      const changeSummary = change.changes
        .map((c) => `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`)
        .join(' · ');
      entries.push({
        id: `edit-${change.id}`,
        type: 'record_edit',
        category: 'update',
        occurredAt: change.createdAt.toISOString(),
        title: 'Project settings updated',
        summary: changeSummary,
        actor: change.actorName,
        metadata: { changes: change.changes },
      });
    }

    entries.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return entries;
  }

  private async getMessagesForActivity(projectId: string, user?: User) {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.projectId = :projectId', { projectId });

    if (user && user.role !== UserRole.ADMIN) {
      qb.andWhere('m.isInternal = false');
    }

    return qb.getMany();
  }

  private serializeQuote(quote: QuoteRequest, user?: User) {
    const isAdmin = !user || user.role === UserRole.ADMIN;
    return {
      id: quote.id,
      contactName: quote.contactName,
      email: quote.email,
      phone: quote.phone,
      company: quote.company,
      serviceType: quote.serviceType,
      projectDescription: quote.projectDescription,
      propertyAddress: quote.propertyAddress,
      pickupAddress: quote.pickupAddress,
      preferredDate: quote.preferredDate,
      status: quote.status,
      statusLabel: QUOTE_STATUS_LABELS[quote.status],
      quotedAmount:
        quote.quotedAmount != null ? Number(quote.quotedAmount) : null,
      estimatedTotal:
        quote.estimatedTotal != null ? Number(quote.estimatedTotal) : null,
      internalNotes: isAdmin ? quote.internalNotes : null,
      milesToStorage: quote.milesToStorage,
      milesToInstall: quote.milesToInstall,
      storageMonths: quote.storageMonths,
      storageLocationName: quote.storageLocationName,
      mileRate: quote.mileRate != null ? Number(quote.mileRate) : null,
      projectBaseFee:
        quote.projectBaseFee != null ? Number(quote.projectBaseFee) : null,
      additionalPickupSurcharge:
        quote.additionalPickupSurcharge != null
          ? Number(quote.additionalPickupSurcharge)
          : null,
      minimumQuote:
        quote.minimumQuote != null ? Number(quote.minimumQuote) : null,
      rooms: quote.rooms,
      lineItems: quote.lineItems,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  private serializeMessage(message: ProjectMessage) {
    return {
      id: message.id,
      projectId: message.projectId,
      authorUserId: message.authorUserId,
      authorName: message.authorName,
      authorRole: message.authorRole,
      body: message.body,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
