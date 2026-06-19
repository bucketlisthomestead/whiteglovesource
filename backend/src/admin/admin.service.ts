import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { Room } from '../entities/room.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { ContactMessage } from '../entities/contact-message.entity';
import { User } from '../entities/user.entity';
import { Designer } from '../entities/designer.entity';
import { Client } from '../entities/client.entity';
import { PieceCatalogItem } from '../entities/piece-catalog-item.entity';
import { StorageLocation } from '../entities/storage-location.entity';
import {
  ConditionRating,
  ChangeOrderType,
  PieceStage,
  ProjectStatus,
  QuoteStatus,
  StorageType,
  PROJECT_STATUS_LABELS,
} from '../common/enums';
import { EmailService } from '../email/email.service';
import {
  AdminUpdateQuoteDto,
  CreateProjectDto,
  CreateProjectFromQuoteDto,
  CreateDesignerInputDto,
  CreateClientInputDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  CreateStorageLocationDto,
  CreateScopeReductionQuoteDto,
  ScopeReductionPreviewDto,
  UpdateProjectDto,
  UpdateStorageLocationDto,
} from '../common/admin.dto';
import { ProjectsService } from '../projects/projects.service';
import { MileageService } from '../mileage/mileage.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateAppSettingsDto } from '../settings/settings.dto';
import { RecordAuditService } from '../audit/record-audit.service';
import { QuoteAuditService } from '../audit/quote-audit.service';
import { CreateQuoteMessageDto } from '../common/quote-message.dto';
import { UserRole } from '../common/roles';
import { generateScanToken } from '../common/scan-token';
import { RolesService } from '../roles/roles.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DashboardDateRange,
  parseDashboardDateRange,
  parseOptionalDateRange,
} from './dashboard-date.util';
import {
  calculateQuoteEstimate,
  buildCreditLineItemsForGroups,
} from '../common/quote-pricing';

const QUOTE_PRICING_FIELDS = [
  'mileRate',
  'projectBaseFee',
  'additionalPickupSurcharge',
  'minimumQuote',
] as const;

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.LEAD]: 'Lead',
  [QuoteStatus.PENDING]: 'Pending review',
  [QuoteStatus.REVIEWING]: 'Under review',
  [QuoteStatus.QUOTED]: 'Quoted',
  [QuoteStatus.ACCEPTED]: 'Accepted',
  [QuoteStatus.DECLINED]: 'Declined',
};

type UserWithProfiles = User & {
  designer: Designer | null;
  client: Client | null;
};

interface WorkContext {
  projects: Project[];
  openQuotes: QuoteRequest[];
}

export interface UserWorkSummary {
  quoted: number;
  inProgress: number;
  finished: number;
}

export interface UserWorkItem {
  id: string;
  kind: 'quote' | 'project';
  title: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
  projectId: string | null;
  isActive: boolean;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(QuoteRequest)
    private readonly quoteRepo: Repository<QuoteRequest>,
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Designer)
    private readonly designerRepo: Repository<Designer>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(PieceCatalogItem)
    private readonly catalogRepo: Repository<PieceCatalogItem>,
    @InjectRepository(StorageLocation)
    private readonly storageLocationRepo: Repository<StorageLocation>,
    private readonly emailService: EmailService,
    private readonly projectsService: ProjectsService,
    private readonly mileageService: MileageService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
    private readonly recordAudit: RecordAuditService,
    private readonly quoteAudit: QuoteAuditService,
    private readonly rolesService: RolesService,
  ) {}

  listDesigners() {
    return this.designerRepo.find({ order: { firm: 'ASC', name: 'ASC' } });
  }

  listClients() {
    return this.clientRepo.find({ order: { name: 'ASC' } });
  }

  async createProject(dto: CreateProjectDto) {
    const designer = await this.resolveDesigner(
      dto.designerId,
      dto.newDesigner,
    );
    const client = await this.resolveClient(dto.clientId, dto.newClient);
    const pricing = await this.settingsService.resolveQuotePricing();

    const project = await this.projectRepo.save(
      this.projectRepo.create({
        name: dto.name,
        description: dto.description,
        propertyAddress: dto.propertyAddress,
        propertyCity: dto.propertyCity,
        targetInstallDate: dto.targetInstallDate,
        designerId: designer.id,
        clientId: client.id,
        status: ProjectStatus.PLANNING,
        isDemo: false,
        mileRate: pricing.mileRate,
        projectBaseFee: pricing.projectBaseFee,
        additionalPickupSurcharge: pricing.additionalPickupSurcharge,
        minimumQuote: pricing.minimumQuote,
      }),
    );

    await this.notificationsService
      .notifyProjectOpened(project, 'direct')
      .catch(() => {});
    return this.projectsService.findOne(project.id);
  }

  async createProjectFromQuote(
    quoteId: string,
    dto: CreateProjectFromQuoteDto,
  ) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.projectId) {
      throw new BadRequestException('A project already exists for this quote');
    }

    const designer = await this.resolveDesigner(
      dto.designerId,
      dto.newDesigner,
    );

    let client: Client;
    if (dto.clientId) {
      const existing = await this.clientRepo.findOne({
        where: { id: dto.clientId },
      });
      if (!existing) throw new BadRequestException('Client not found');
      client = existing;
    } else if (dto.newClient) {
      client = await this.createClientWithUser(dto.newClient);
    } else {
      const created = await this.findOrCreateClientFromQuote(quote);
      if (!created) throw new BadRequestException('Client is required');
      client = created;
    }

    const projectName = dto.name.trim();
    if (!projectName) {
      throw new BadRequestException('Project name is required');
    }

    const pricing = await this.settingsService.resolveQuotePricing(quote);

    const project = await this.projectRepo.save(
      this.projectRepo.create({
        name: projectName,
        description: quote.projectDescription,
        propertyAddress: quote.propertyAddress || 'TBD',
        propertyCity: this.extractCity(quote.propertyAddress),
        targetInstallDate: quote.preferredDate ?? undefined,
        designerId: designer.id,
        clientId: client.id,
        status: ProjectStatus.PLANNING,
        isDemo: false,
        stagingPlanOverview: quote.storageMonths
          ? `${quote.storageMonths} month(s) ${quote.storageType.replace(/_/g, ' ')} storage · ${quote.milesToStorage} mi to warehouse · ${quote.milesToInstall} mi to install`
          : undefined,
        mileRate: pricing.mileRate,
        projectBaseFee: pricing.projectBaseFee,
        additionalPickupSurcharge: pricing.additionalPickupSurcharge,
        minimumQuote: pricing.minimumQuote,
      }),
    );

    if (quote.rooms?.length) {
      await this.seedProjectFromQuoteRooms(project.id, quote.rooms);
    }

    quote.projectId = project.id;
    quote.status = QuoteStatus.ACCEPTED;
    if (quote.estimatedTotal && !quote.quotedAmount) {
      quote.quotedAmount = quote.estimatedTotal;
    }
    await this.quoteRepo.save(quote);

    await this.notificationsService
      .notifyProjectOpened(project, 'quote')
      .catch(() => {});
    return this.projectsService.findOne(project.id);
  }

  async createChangeOrderQuote(projectId: string, user?: User) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: { client: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.isDemo) {
      throw new BadRequestException('Cannot add change orders to the demo project');
    }

    const existingCount = await this.quoteRepo.count({
      where: { parentProjectId: projectId },
    });
    const changeOrderNumber = existingCount + 1;

    const quote = await this.quoteRepo.save(
      this.quoteRepo.create({
        contactName: project.client.name,
        email: project.client.email,
        phone: project.client.phone ?? null,
        company: null,
        serviceType: `Change order #${changeOrderNumber}`,
        projectDescription: `Additional furnishings and services for ${project.name}`,
        propertyAddress: project.propertyAddress,
        pickupAddress: project.propertyAddress,
        preferredDate: project.targetInstallDate ?? null,
        status: QuoteStatus.PENDING,
        parentProjectId: projectId,
        changeOrderNumber,
        changeOrderType: ChangeOrderType.ADDITION,
        mileRate: project.mileRate,
        projectBaseFee: project.projectBaseFee,
        additionalPickupSurcharge: project.additionalPickupSurcharge,
        minimumQuote: project.minimumQuote,
        rooms: [],
        milesToStorage: 0,
        milesToInstall: 0,
        storageMonths: 1,
        storageType: StorageType.STANDARD_CLIMATE,
        pickupLocationCount: 1,
      }),
    );

    if (user) {
      await this.recordAudit.recordQuoteUpdate(
        user,
        quote.id,
        {},
        this.recordAudit.quoteSnapshot(quote),
      );
    }

    return quote;
  }

  async listProjectChangeOrders(projectId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const orders = await this.quoteRepo.find({
      where: { parentProjectId: projectId },
      order: { changeOrderNumber: 'ASC' },
    });

    return orders.map((q) => ({
      id: q.id,
      changeOrderNumber: q.changeOrderNumber,
      changeOrderType: q.changeOrderType ?? ChangeOrderType.ADDITION,
      serviceType: q.serviceType,
      status: q.status,
      quotedAmount: q.quotedAmount != null ? Number(q.quotedAmount) : null,
      estimatedTotal: q.estimatedTotal != null ? Number(q.estimatedTotal) : null,
      estimatedPieces: q.estimatedPieces ?? null,
      roomCount: q.rooms?.length ?? 0,
      removalPieceCount: q.removalTargets?.pieceIds?.length ?? 0,
      appliedAt: q.appliedAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }));
  }

  async previewScopeReduction(
    projectId: string,
    dto: ScopeReductionPreviewDto,
  ) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: { rooms: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.isDemo) {
      throw new BadRequestException('Cannot reduce scope on the demo project');
    }

    const pieceIds = dto.pieceIds ?? [];
    const roomIds = dto.roomIds ?? [];
    if (!pieceIds.length && !roomIds.length) {
      throw new BadRequestException('Select at least one room or piece to remove');
    }

    const pieces = await this.resolveRemovalPieces(projectId, pieceIds, roomIds);
    if (!pieces.length) {
      throw new BadRequestException('No matching inventory found for removal');
    }

    const catalog = await this.catalogRepo.find();
    const pricingContext = await this.getProjectQuotePricingContext(projectId);
    const rates = await this.settingsService.resolveQuotePricing(pricingContext);
    const groups = this.groupPiecesForCredit(pieces, catalog);
    const proposedLineItems = buildCreditLineItemsForGroups(
      groups,
      {
        storageMonths: pricingContext.storageMonths,
        storageType: pricingContext.storageType,
      },
      catalog.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        pickupFee: Number(c.pickupFee),
        storageFeeMonthly: Number(c.storageFeeMonthly),
        installFee: Number(c.installFee),
      })),
      rates,
    );

    const creditTotal = proposedLineItems.reduce(
      (sum, line) => sum + Number(line.amount),
      0,
    );

    return {
      pieces: pieces.map((p) => ({
        id: p.id,
        name: p.name,
        roomId: p.roomId,
        roomName: p.room?.name ?? 'Unassigned',
        catalogItemId: p.catalogItemId,
      })),
      proposedLineItems,
      creditTotal,
      storageMonths: pricingContext.storageMonths,
      storageType: pricingContext.storageType,
    };
  }

  async createScopeReductionQuote(
    projectId: string,
    dto: CreateScopeReductionQuoteDto,
    user?: User,
  ) {
    const preview = await this.previewScopeReduction(projectId, dto);
    const selectedKeys = new Set(dto.selectedLineItemKeys);
    const selectedLineItems = preview.proposedLineItems.filter((line) =>
      selectedKeys.has(line.key),
    );
    if (!selectedLineItems.length) {
      throw new BadRequestException('Select at least one credit line item');
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: { client: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const existingCount = await this.quoteRepo.count({
      where: { parentProjectId: projectId },
    });
    const changeOrderNumber = existingCount + 1;
    const creditTotal = selectedLineItems.reduce(
      (sum, line) => sum + Number(line.amount),
      0,
    );

    const pieceIds = preview.pieces.map((p) => p.id);
    const roomIds = dto.roomIds ?? [];

    const quote = await this.quoteRepo.save(
      this.quoteRepo.create({
        contactName: project.client.name,
        email: project.client.email,
        phone: project.client.phone ?? null,
        company: null,
        serviceType: `Scope reduction #${changeOrderNumber}`,
        projectDescription: `Remove furnishings from ${project.name}`,
        propertyAddress: project.propertyAddress,
        pickupAddress: project.propertyAddress,
        preferredDate: project.targetInstallDate ?? null,
        status: QuoteStatus.PENDING,
        parentProjectId: projectId,
        changeOrderNumber,
        changeOrderType: ChangeOrderType.REDUCTION,
        removalTargets: { pieceIds, roomIds },
        creditLineItems: selectedLineItems.map(
          ({ key: _key, roomName: _room, catalogItemId: _cat, catalogName: _name, ...line }) =>
            line,
        ),
        lineItems: selectedLineItems.map(
          ({ key: _key, roomName: _room, catalogItemId: _cat, catalogName: _name, ...line }) =>
            line,
        ),
        quotedAmount: creditTotal,
        estimatedTotal: creditTotal,
        estimatedPieces: pieceIds.length,
        mileRate: project.mileRate,
        projectBaseFee: project.projectBaseFee,
        additionalPickupSurcharge: project.additionalPickupSurcharge,
        minimumQuote: project.minimumQuote,
        rooms: [],
        milesToStorage: 0,
        milesToInstall: 0,
        storageMonths: preview.storageMonths,
        storageType: preview.storageType,
        pickupLocationCount: 1,
      }),
    );

    if (user) {
      await this.recordAudit.recordQuoteUpdate(
        user,
        quote.id,
        {},
        this.recordAudit.quoteSnapshot(quote),
      );
    }

    return quote;
  }

  async applyChangeOrderToProject(quoteId: string, user?: User) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (!quote.parentProjectId) {
      throw new BadRequestException('This quote is not a project change order');
    }
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException(
        'Change order must be accepted before applying to the project',
      );
    }
    if (quote.appliedAt) {
      throw new BadRequestException('This change order has already been applied');
    }

    const isReduction = quote.changeOrderType === ChangeOrderType.REDUCTION;

    if (isReduction) {
      if (!quote.removalTargets?.pieceIds?.length) {
        throw new BadRequestException('Reduction quote has no removal targets');
      }
      if (!quote.creditLineItems?.length) {
        throw new BadRequestException('Reduction quote has no credit line items');
      }

      const project = await this.projectRepo.findOne({
        where: { id: quote.parentProjectId },
      });
      if (!project) throw new NotFoundException('Parent project not found');

      const removed = await this.applyScopeReductionToProject(
        quote.parentProjectId,
        quote.removalTargets,
      );

      quote.appliedAt = new Date();
      await this.quoteRepo.save(quote);

      if (user) {
        await this.recordAudit.recordQuoteUpdate(
          user,
          quote.id,
          {},
          this.recordAudit.quoteSnapshot(quote),
        );
      }

      return {
        projectId: quote.parentProjectId,
        appliedAt: quote.appliedAt.toISOString(),
        piecesRemoved: removed.piecesRemoved,
        roomsRemoved: removed.roomsRemoved,
      };
    }

    if (!quote.rooms?.length) {
      throw new BadRequestException('Add rooms and catalogue items before applying');
    }

    const project = await this.projectRepo.findOne({
      where: { id: quote.parentProjectId },
    });
    if (!project) throw new NotFoundException('Parent project not found');

    const added = await this.mergeQuoteRoomsIntoProject(
      quote.parentProjectId,
      quote.rooms,
      true,
    );

    quote.appliedAt = new Date();
    await this.quoteRepo.save(quote);

    if (user) {
      await this.recordAudit.recordQuoteUpdate(
        user,
        quote.id,
        {},
        this.recordAudit.quoteSnapshot(quote),
      );
    }

    return {
      projectId: quote.parentProjectId,
      appliedAt: quote.appliedAt.toISOString(),
      roomsAdded: added.roomsAdded,
      piecesAdded: added.piecesAdded,
    };
  }

  private async applyScopeReductionToProject(
    projectId: string,
    targets: NonNullable<QuoteRequest['removalTargets']>,
  ) {
    const pieces = await this.pieceRepo.find({
      where: { id: In(targets.pieceIds), projectId },
    });
    if (pieces.length !== targets.pieceIds.length) {
      throw new BadRequestException(
        'Some pieces were not found — refresh and try again',
      );
    }

    await this.pieceRepo.delete({ id: In(targets.pieceIds), projectId });

    let roomsRemoved = 0;
    const roomIdsToCheck = new Set([
      ...targets.roomIds,
      ...pieces.map((p) => p.roomId).filter((id): id is string => !!id),
    ]);

    for (const roomId of roomIdsToCheck) {
      const remaining = await this.pieceRepo.count({ where: { roomId, projectId } });
      if (remaining === 0) {
        await this.roomRepo.delete({ id: roomId, projectId });
        roomsRemoved++;
      }
    }

    return { piecesRemoved: pieces.length, roomsRemoved };
  }

  private async resolveRemovalPieces(
    projectId: string,
    pieceIds: string[],
    roomIds: string[],
  ): Promise<Piece[]> {
    const pieces: Piece[] = [];
    if (pieceIds.length) {
      const found = await this.pieceRepo.find({
        where: { id: In(pieceIds), projectId },
        relations: { room: true },
      });
      pieces.push(...found);
    }
    if (roomIds.length) {
      const roomPieces = await this.pieceRepo.find({
        where: { projectId, roomId: In(roomIds) },
        relations: { room: true },
      });
      for (const piece of roomPieces) {
        if (!pieces.some((p) => p.id === piece.id)) pieces.push(piece);
      }
    }
    return pieces;
  }

  private groupPiecesForCredit(
    pieces: Piece[],
    catalog: PieceCatalogItem[],
  ): { roomName: string; catalogItemId: string; quantity: number }[] {
    const groupMap = new Map<
      string,
      { roomName: string; catalogItemId: string; quantity: number }
    >();

    for (const piece of pieces) {
      const catalogItemId = this.resolveCatalogIdForPiece(piece, catalog);
      if (!catalogItemId) continue;
      const roomName = piece.room?.name ?? 'Unassigned';
      const key = `${roomName.toLowerCase()}|${catalogItemId}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        groupMap.set(key, { roomName, catalogItemId, quantity: 1 });
      }
    }

    const groups = [...groupMap.values()];
    if (!groups.length) {
      throw new BadRequestException(
        'Could not match selected pieces to catalogue pricing — ensure pieces were created from quotes',
      );
    }
    return groups;
  }

  private resolveCatalogIdForPiece(
    piece: Piece,
    catalog: PieceCatalogItem[],
  ): string | null {
    if (piece.catalogItemId) return piece.catalogItemId;
    const baseName = piece.name.replace(/ \(\d+ of \d+\)$/, '').trim().toLowerCase();
    const match = catalog.find((c) => c.name.trim().toLowerCase() === baseName);
    return match?.id ?? null;
  }

  private async getProjectQuotePricingContext(projectId: string) {
    const original = await this.quoteRepo.findOne({ where: { projectId } });
    if (original) return original;

    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return {
      storageMonths: 1,
      storageType: StorageType.STANDARD_CLIMATE,
      mileRate: project.mileRate,
      projectBaseFee: project.projectBaseFee,
      additionalPickupSurcharge: project.additionalPickupSurcharge,
      minimumQuote: project.minimumQuote,
    } as QuoteRequest;
  }

  private static readonly PROJECT_STATUS_ORDER: ProjectStatus[] = [
    ProjectStatus.PLANNING,
    ProjectStatus.PICKUP_STORAGE,
    ProjectStatus.INSTALLATION,
    ProjectStatus.COMPLETE,
  ];

  private assertProjectStatusAdvance(from: ProjectStatus, to: ProjectStatus) {
    const fromIdx = AdminService.PROJECT_STATUS_ORDER.indexOf(from);
    const toIdx = AdminService.PROJECT_STATUS_ORDER.indexOf(to);
    if (toIdx !== fromIdx + 1) {
      throw new BadRequestException(
        `Project can only advance one phase at a time (${PROJECT_STATUS_LABELS[from]} → ${PROJECT_STATUS_LABELS[to]})`,
      );
    }
  }

  private todayDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  async updateProject(id: string, dto: UpdateProjectDto, user?: User) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.isDemo) {
      throw new BadRequestException('Demo project settings cannot be changed');
    }

    const before = this.recordAudit.projectSnapshot(project);

    if (dto.isActive != null) {
      project.isActive = dto.isActive;
    }
    if (dto.status != null && dto.status !== project.status) {
      this.assertProjectStatusAdvance(project.status, dto.status);
      if (
        project.status === ProjectStatus.PLANNING &&
        !project.planningCompletedDate
      ) {
        project.planningCompletedDate = this.todayDateString();
      }
      project.status = dto.status;
    }

    await this.projectRepo.save(project);

    if (user) {
      await this.recordAudit.recordProjectUpdate(
        user,
        id,
        before,
        this.recordAudit.projectSnapshot(project),
      );
    }

    return this.projectsService.findOne(id);
  }

  private async seedProjectFromQuoteRooms(
    projectId: string,
    rooms: NonNullable<QuoteRequest['rooms']>,
  ) {
    await this.mergeQuoteRoomsIntoProject(projectId, rooms, false);
  }

  private async mergeQuoteRoomsIntoProject(
    projectId: string,
    rooms: NonNullable<QuoteRequest['rooms']>,
    mergeExistingRooms: boolean,
  ) {
    const catalogIds = [
      ...new Set(rooms.flatMap((r) => r.items.map((i) => i.catalogItemId))),
    ];
    const catalogItems = catalogIds.length
      ? await this.catalogRepo
          .createQueryBuilder('c')
          .where('c.id IN (:...ids)', { ids: catalogIds })
          .getMany()
      : [];
    const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));

    const existingRooms = mergeExistingRooms
      ? await this.roomRepo.find({
          where: { projectId },
          order: { sortOrder: 'ASC' },
        })
      : [];
    const roomByName = new Map(
      existingRooms.map((r) => [r.name.trim().toLowerCase(), r]),
    );
    let nextSort =
      existingRooms.length > 0
        ? Math.max(...existingRooms.map((r) => r.sortOrder)) + 1
        : 0;

    let roomsAdded = 0;
    let piecesAdded = 0;

    for (const roomInput of rooms) {
      const key = roomInput.name.trim().toLowerCase();
      let room = mergeExistingRooms ? roomByName.get(key) : undefined;

      if (!room) {
        room = await this.roomRepo.save(
          this.roomRepo.create({
            projectId,
            name: roomInput.name.trim(),
            sortOrder: nextSort++,
          }),
        );
        if (mergeExistingRooms) {
          roomByName.set(key, room);
        }
        roomsAdded++;
      }

      for (const item of roomInput.items) {
        const catalog = catalogMap.get(item.catalogItemId);
        if (!catalog) continue;

        for (let n = 0; n < item.quantity; n++) {
          const suffix =
            item.quantity > 1 ? ` (${n + 1} of ${item.quantity})` : '';
          await this.pieceRepo.save(
            this.pieceRepo.create({
              projectId,
              roomId: room.id,
              catalogItemId: item.catalogItemId,
              name: `${catalog.name}${suffix}`,
              description: catalog.description,
              currentStage: PieceStage.IDENTIFIED,
              currentCondition: ConditionRating.EXCELLENT,
              currentLocation: 'On inventory manifest — awaiting pickup',
              scanToken: generateScanToken(),
            }),
          );
          piecesAdded++;
        }
      }
    }

    return { roomsAdded, piecesAdded };
  }

  private async findOrCreateClientFromQuote(quote: QuoteRequest) {
    let client = await this.clientRepo.findOne({
      where: { email: quote.email },
    });
    if (!client) {
      client = await this.clientRepo.save(
        this.clientRepo.create({
          name: quote.contactName,
          email: quote.email,
          phone: quote.phone ?? undefined,
          address: quote.propertyAddress ?? undefined,
        }),
      );
    }
    return client;
  }

  private async resolveDesigner(
    designerId?: string,
    newDesigner?: CreateDesignerInputDto,
  ) {
    if (designerId && newDesigner) {
      throw new BadRequestException(
        'Provide either designerId or newDesigner, not both',
      );
    }
    if (designerId) {
      const designer = await this.designerRepo.findOne({
        where: { id: designerId },
      });
      if (!designer) throw new BadRequestException('Designer not found');
      return designer;
    }
    if (newDesigner) {
      return this.createDesignerWithUser(newDesigner);
    }
    throw new BadRequestException('Designer is required');
  }

  private async resolveClient(
    clientId?: string,
    newClient?: CreateClientInputDto,
  ) {
    if (clientId && newClient) {
      throw new BadRequestException(
        'Provide either clientId or newClient, not both',
      );
    }
    if (clientId) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new BadRequestException('Client not found');
      return client;
    }
    if (newClient) {
      return this.createClientWithUser(newClient);
    }
    throw new BadRequestException('Client is required');
  }

  private async createDesignerWithUser(dto: CreateDesignerInputDto) {
    const email = dto.email.toLowerCase();
    const existingDesigner = await this.designerRepo.findOne({
      where: { email },
    });
    if (existingDesigner) {
      throw new ConflictException('A designer with this email already exists');
    }

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const designer = await this.designerRepo.save(
      this.designerRepo.create({
        name: dto.name,
        firm: dto.firm,
        email,
        phone: dto.phone,
        city: dto.city,
      }),
    );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        name: dto.name,
        role: UserRole.DESIGNER,
        designerId: designer.id,
      }),
    );

    return designer;
  }

  private async createClientWithUser(dto: CreateClientInputDto) {
    const email = dto.email.toLowerCase();
    const existingClient = await this.clientRepo.findOne({ where: { email } });
    if (existingClient) {
      throw new ConflictException('A client with this email already exists');
    }

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const client = await this.clientRepo.save(
      this.clientRepo.create({
        name: dto.name,
        email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
      }),
    );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        name: dto.name,
        role: UserRole.CLIENT,
        clientId: client.id,
      }),
    );

    return client;
  }

  private extractCity(address?: string | null) {
    if (!address) return undefined;
    const parts = address.split(',').map((p) => p.trim());
    return parts.length > 1 ? parts[parts.length - 1] : undefined;
  }

  async getDashboard(
    options: {
      includeArchived?: boolean;
      from?: string;
      to?: string;
    } = {},
  ) {
    const includeArchived = options.includeArchived ?? false;
    const dateRange = parseDashboardDateRange(options.from, options.to);

    const [
      projects,
      projectsInProgress,
      projectsComplete,
      pieces,
      quotes,
      messages,
      users,
      pendingQuotes,
      leadQuotes,
      quotesTotalRaw,
      pendingQuotesTotalRaw,
      leadQuotesTotalRaw,
    ] = await Promise.all([
      this.countProjectsInRange(dateRange, includeArchived),
      this.countProjectsInRange(
        dateRange,
        includeArchived,
        Not(ProjectStatus.COMPLETE),
      ),
      this.countProjectsInRange(
        dateRange,
        includeArchived,
        ProjectStatus.COMPLETE,
      ),
      this.countPiecesInRange(dateRange, includeArchived),
      this.countOpenQuotesInRange(dateRange, includeArchived),
      this.countUnreadMessagesInRange(dateRange),
      this.userRepo.count(),
      this.countOpenQuotesInRange(
        dateRange,
        includeArchived,
        QuoteStatus.PENDING,
      ),
      this.countOpenQuotesInRange(dateRange, includeArchived, QuoteStatus.LEAD),
      this.sumOpenQuoteValues(includeArchived, dateRange),
      this.sumOpenQuoteValues(includeArchived, dateRange, QuoteStatus.PENDING),
      this.sumOpenQuoteValues(includeArchived, dateRange, QuoteStatus.LEAD),
    ]);

    const inProgressProjectIds = await this.findProjectIdsInRange(
      dateRange,
      includeArchived,
      Not(ProjectStatus.COMPLETE),
    );
    const completeProjectIds = await this.findProjectIdsInRange(
      dateRange,
      includeArchived,
      ProjectStatus.COMPLETE,
    );
    const [projectsInProgressTotal, projectsCompleteTotal] = await Promise.all([
      this.sumProjectValues(inProgressProjectIds),
      this.sumProjectValues(completeProjectIds),
    ]);

    const recentQuotes = await this.findOpenQuotesInRange(
      dateRange,
      includeArchived,
      5,
    );
    const recentMessages = await this.contactRepo
      .createQueryBuilder('m')
      .where('DATE(m.createdAt) BETWEEN :from AND :to', dateRange)
      .orderBy('m.createdAt', 'DESC')
      .take(5)
      .getMany();
    const activeProjects = await this.findProjectsInRange(
      dateRange,
      includeArchived,
      10,
    );

    return {
      dateRange,
      stats: {
        projects,
        projectsInProgress,
        projectsInProgressTotal,
        projectsComplete,
        projectsCompleteTotal,
        pieces,
        quotes,
        quotesTotal: quotesTotalRaw,
        unreadMessages: messages,
        users,
        pendingQuotes,
        pendingQuotesTotal: pendingQuotesTotalRaw,
        leadQuotes,
        leadQuotesTotal: leadQuotesTotalRaw,
      },
      recentQuotes,
      recentMessages,
      activeProjects,
    };
  }

  async listQuotes(
    options: {
      includeArchived?: boolean;
      from?: string;
      to?: string;
      status?: QuoteStatus;
    } = {},
  ) {
    const includeArchived = options.includeArchived ?? false;
    const dateRange = parseOptionalDateRange(options.from, options.to);
    const qb = this.quoteRepo
      .createQueryBuilder('q')
      .orderBy('q.createdAt', 'DESC');

    if (!includeArchived) {
      qb.andWhere('q.isActive = true');
    }
    if (options.status) {
      qb.andWhere('q.status = :status', { status: options.status });
    }
    if (dateRange) {
      qb.andWhere(
        'COALESCE(q.preferredDate, DATE(q.createdAt)) BETWEEN :from AND :to',
        dateRange,
      );
    }

    const quotes = await qb.getMany();
    return { quotes, dateRange };
  }

  private quoteDateExpr(alias: string) {
    return `COALESCE(${alias}.preferredDate, DATE(${alias}.createdAt))`;
  }

  private projectDateExpr(alias: string) {
    return `COALESCE(${alias}.targetInstallDate, DATE(${alias}.createdAt))`;
  }

  private applyOpenQuoteBase(
    qb: ReturnType<Repository<QuoteRequest>['createQueryBuilder']>,
    alias: string,
    includeArchived: boolean,
    range: DashboardDateRange,
  ) {
    qb.where(`${alias}.projectId IS NULL`).andWhere(
      `${this.quoteDateExpr(alias)} BETWEEN :from AND :to`,
      range,
    );
    if (!includeArchived) {
      qb.andWhere(`${alias}.isActive = true`);
    }
  }

  private applyProjectBase(
    qb: ReturnType<Repository<Project>['createQueryBuilder']>,
    alias: string,
    includeArchived: boolean,
    range: DashboardDateRange,
  ) {
    qb.where(`${alias}.isDemo = false`).andWhere(
      `${this.projectDateExpr(alias)} BETWEEN :from AND :to`,
      range,
    );
    if (!includeArchived) {
      qb.andWhere(`${alias}.isActive = true`);
    }
  }

  private countOpenQuotesInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
    status?: QuoteStatus,
  ) {
    const qb = this.quoteRepo.createQueryBuilder('q');
    this.applyOpenQuoteBase(qb, 'q', includeArchived, range);
    if (status) {
      qb.andWhere('q.status = :status', { status });
    }
    return qb.getCount();
  }

  private findOpenQuotesInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
    take: number,
  ) {
    const qb = this.quoteRepo.createQueryBuilder('q');
    this.applyOpenQuoteBase(qb, 'q', includeArchived, range);
    return qb.orderBy('q.createdAt', 'DESC').take(take).getMany();
  }

  private countProjectsInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
    status?: ProjectStatus | ReturnType<typeof Not>,
  ) {
    const qb = this.projectRepo.createQueryBuilder('p');
    this.applyProjectBase(qb, 'p', includeArchived, range);
    if (status !== undefined) {
      if (typeof status === 'string') {
        qb.andWhere('p.status = :status', { status });
      } else {
        qb.andWhere('p.status != :complete', {
          complete: ProjectStatus.COMPLETE,
        });
      }
    }
    return qb.getCount();
  }

  private findProjectIdsInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
    status?: ProjectStatus | ReturnType<typeof Not>,
  ) {
    const qb = this.projectRepo.createQueryBuilder('p').select('p.id', 'id');
    this.applyProjectBase(qb, 'p', includeArchived, range);
    if (status !== undefined) {
      if (typeof status === 'string') {
        qb.andWhere('p.status = :status', { status });
      } else {
        qb.andWhere('p.status != :complete', {
          complete: ProjectStatus.COMPLETE,
        });
      }
    }
    return qb
      .getRawMany<{ id: string }>()
      .then((rows) => rows.map((r) => r.id));
  }

  private findProjectsInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
    take: number,
  ) {
    const qb = this.projectRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.designer', 'designer')
      .leftJoinAndSelect('p.client', 'client');
    this.applyProjectBase(qb, 'p', includeArchived, range);
    return qb.orderBy('p.updatedAt', 'DESC').take(take).getMany();
  }

  private countPiecesInRange(
    range: DashboardDateRange,
    includeArchived: boolean,
  ) {
    const qb = this.pieceRepo
      .createQueryBuilder('pc')
      .innerJoin('pc.project', 'p')
      .where('p.isDemo = false')
      .andWhere(`${this.projectDateExpr('p')} BETWEEN :from AND :to`, range);
    if (!includeArchived) {
      qb.andWhere('p.isActive = true');
    }
    return qb.getCount();
  }

  private countUnreadMessagesInRange(range: DashboardDateRange) {
    return this.contactRepo
      .createQueryBuilder('m')
      .where('m.isRead = false')
      .andWhere('DATE(m.createdAt) BETWEEN :from AND :to', range)
      .getCount();
  }

  private async sumOpenQuoteValues(
    includeArchived: boolean,
    range: DashboardDateRange,
    status?: QuoteStatus,
  ): Promise<number> {
    const qb = this.quoteRepo
      .createQueryBuilder('q')
      .select(
        'COALESCE(SUM(COALESCE(q.quotedAmount, q.estimatedTotal, 0)), 0)',
        'total',
      );
    this.applyOpenQuoteBase(qb, 'q', includeArchived, range);

    if (status) {
      qb.andWhere('q.status = :status', { status });
    }

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumProjectValues(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;

    const [quotes, pieceRows] = await Promise.all([
      this.quoteRepo.find({
        where: { projectId: In(projectIds) },
        select: { projectId: true, quotedAmount: true, estimatedTotal: true },
      }),
      this.pieceRepo
        .createQueryBuilder('p')
        .select('p.projectId', 'projectId')
        .addSelect('COALESCE(SUM(p.value), 0)', 'total')
        .where('p.projectId IN (:...projectIds)', { projectIds })
        .groupBy('p.projectId')
        .getRawMany<{ projectId: string; total: string }>(),
    ]);

    const quoteByProject = new Map(
      quotes.map((q) => [
        q.projectId!,
        Number(q.quotedAmount ?? q.estimatedTotal ?? 0),
      ]),
    );
    const piecesByProject = new Map(
      pieceRows.map((r) => [r.projectId, Number(r.total ?? 0)]),
    );

    return projectIds.reduce((sum, id) => {
      const quoteVal = quoteByProject.get(id);
      if (quoteVal != null && quoteVal > 0) return sum + quoteVal;
      return sum + (piecesByProject.get(id) ?? 0);
    }, 0);
  }

  async getQuote(id: string) {
    const quote = await this.quoteRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async updateQuote(
    id: string,
    dto: AdminUpdateQuoteDto,
    sendEmail = false,
    user?: User,
  ) {
    const quote = await this.quoteRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.projectId || quote.parentProjectId) {
      for (const field of QUOTE_PRICING_FIELDS) {
        if (dto[field] !== undefined) {
          throw new BadRequestException(
            'Pricing settings cannot be changed after a project is created',
          );
        }
      }
    }

    const before = this.recordAudit.quoteSnapshot(quote);

    if (dto.contactName != null) quote.contactName = dto.contactName.trim();
    if (dto.email != null) quote.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) quote.phone = dto.phone?.trim() || null;
    if (dto.company !== undefined) quote.company = dto.company?.trim() || null;
    if (dto.serviceType != null) quote.serviceType = dto.serviceType.trim();
    if (dto.projectDescription != null)
      quote.projectDescription = dto.projectDescription.trim();
    if (dto.propertyAddress !== undefined)
      quote.propertyAddress = dto.propertyAddress?.trim() || null;
    if (dto.pickupAddress !== undefined)
      quote.pickupAddress = dto.pickupAddress?.trim() || null;
    if (dto.preferredDate !== undefined)
      quote.preferredDate = dto.preferredDate || null;
    if (dto.estimatedPieces != null)
      quote.estimatedPieces = dto.estimatedPieces;
    if (dto.quotedAmount != null) quote.quotedAmount = dto.quotedAmount;
    if (dto.internalNotes !== undefined)
      quote.internalNotes = dto.internalNotes?.trim() || null;
    if (dto.status) quote.status = dto.status as QuoteStatus;
    if (dto.milesToStorage != null) quote.milesToStorage = dto.milesToStorage;
    if (dto.milesToInstall != null) quote.milesToInstall = dto.milesToInstall;
    if (dto.storageMonths != null) quote.storageMonths = dto.storageMonths;
    if (dto.storageType != null) quote.storageType = dto.storageType;
    if (dto.pickupLocationCount != null)
      quote.pickupLocationCount = dto.pickupLocationCount;
    if (!quote.projectId && !quote.parentProjectId) {
      if (dto.mileRate !== undefined) quote.mileRate = dto.mileRate;
      if (dto.projectBaseFee !== undefined)
        quote.projectBaseFee = dto.projectBaseFee;
      if (dto.additionalPickupSurcharge !== undefined) {
        quote.additionalPickupSurcharge = dto.additionalPickupSurcharge;
      }
      if (dto.minimumQuote !== undefined) quote.minimumQuote = dto.minimumQuote;
    }
    if (dto.isActive != null) quote.isActive = dto.isActive;
    if (dto.rooms !== undefined) quote.rooms = dto.rooms;

    await this.recalculateQuoteEstimate(quote);

    await this.quoteRepo.save(quote);

    if (user) {
      await this.recordAudit.recordQuoteUpdate(
        user,
        id,
        before,
        this.recordAudit.quoteSnapshot(quote),
      );
    }

    if (sendEmail) {
      const amount =
        quote.quotedAmount != null ? Number(quote.quotedAmount) : null;
      if (!amount || amount <= 0) {
        throw new BadRequestException(
          'Quoted amount is required to send the quote',
        );
      }
      if (!quote.email) {
        throw new BadRequestException(
          'Client email is required to send the quote',
        );
      }

      await this.emailService.sendQuoteToClient({
        email: quote.email,
        contactName: quote.contactName,
        quotedAmount: amount,
        serviceType: quote.serviceType,
        projectDescription: quote.projectDescription,
        propertyAddress: quote.propertyAddress ?? undefined,
        pickupAddress: quote.pickupAddress ?? undefined,
        preferredDate: quote.preferredDate ?? undefined,
        milesToStorage: quote.milesToStorage,
        milesToInstall: quote.milesToInstall,
        storageMonths: quote.storageMonths,
        storageLocationName: quote.storageLocationName ?? undefined,
        estimatedTotal:
          quote.estimatedTotal != null
            ? Number(quote.estimatedTotal)
            : undefined,
        lineItems: quote.lineItems?.map((li) => ({
          description: li.description,
          amount: Number(li.amount),
        })),
      });
      quote.status = QuoteStatus.QUOTED;
      await this.quoteRepo.save(quote);

      if (user) {
        const sentChanges = this.recordAudit.diffQuoteFields(
          before,
          this.recordAudit.quoteSnapshot(quote),
          ['quotedAmount', 'status'],
        );
        await this.recordAudit.recordQuoteSent(user, id, sentChanges);
      }
    }

    return quote;
  }

  getQuoteActivity(quoteId: string) {
    return this.quoteAudit.getActivity(quoteId);
  }

  getQuoteMessages(quoteId: string) {
    return this.quoteAudit.getMessages(quoteId);
  }

  createQuoteMessage(quoteId: string, user: User, dto: CreateQuoteMessageDto) {
    return this.quoteAudit.createMessage(quoteId, user, dto);
  }

  getSettings() {
    return this.settingsService.getSettings();
  }

  updateSettings(dto: UpdateAppSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  async markMessageRead(id: string) {
    await this.contactRepo.update(id, { isRead: true });
    return this.contactRepo.findOne({ where: { id } });
  }

  listStorageLocations() {
    return this.storageLocationRepo.find({ order: { name: 'ASC' } });
  }

  async createStorageLocation(dto: CreateStorageLocationDto) {
    let location = this.storageLocationRepo.create({
      ...dto,
      isActive: true,
    });
    location = await this.mileageService.geocodeStorageLocation(location);
    return this.storageLocationRepo.save(location);
  }

  async updateStorageLocation(id: string, dto: UpdateStorageLocationDto) {
    const location = await this.storageLocationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Storage location not found');

    Object.assign(location, dto);
    if (dto.address || dto.city || dto.state || dto.zip) {
      await this.mileageService.geocodeStorageLocation(location);
    }
    return this.storageLocationRepo.save(location);
  }

  async deleteStorageLocation(id: string) {
    const location = await this.storageLocationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Storage location not found');
    await this.storageLocationRepo.remove(location);
    return { deleted: true };
  }

  async listUsers() {
    const [users, workContext] = await Promise.all([
      this.userRepo.find({
        relations: { designer: true, client: true },
        order: { createdAt: 'DESC' },
      }),
      this.loadWorkContext(),
    ]);

    return users.map((u) => ({
      ...this.serializeAdminUser(u),
      workSummary: this.buildUserWork(u, workContext, false).summary,
    }));
  }

  async getUserWork(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { designer: true, client: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const workContext = await this.loadWorkContext();
    return this.buildUserWork(user, workContext, true);
  }

  async createAdminUser(dto: CreateAdminUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing)
      throw new ConflictException('A user with this email already exists');

    await this.rolesService.assertRoleAssignable(dto.role);

    let designerId: string | null = null;
    let clientId: string | null = null;

    if (dto.role === UserRole.DESIGNER) {
      if (dto.designerId) {
        const designer = await this.designerRepo.findOne({
          where: { id: dto.designerId },
        });
        if (!designer) throw new BadRequestException('Designer not found');
        designerId = designer.id;
      } else if (dto.newDesigner) {
        const designer = await this.createDesignerProfile(
          email,
          dto.newDesigner,
        );
        designerId = designer.id;
      } else {
        throw new BadRequestException(
          'Designer profile is required for designer accounts',
        );
      }
    }

    if (dto.role === UserRole.CLIENT) {
      if (dto.clientId) {
        const client = await this.clientRepo.findOne({
          where: { id: dto.clientId },
        });
        if (!client) throw new BadRequestException('Client not found');
        clientId = client.id;
      } else if (dto.newClient) {
        const client = await this.createClientProfile(
          dto.name,
          email,
          dto.newClient,
        );
        clientId = client.id;
      } else {
        throw new BadRequestException(
          'Client profile is required for client accounts',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        designerId,
        clientId,
      }),
    );

    return this.findUserById(user.id);
  }

  async updateAdminUser(id: string, dto: UpdateAdminUserDto, actorId?: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { designer: true, client: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (dto.isActive === false && actorId && id === actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (dto.name != null) user.name = dto.name;
    if (dto.isActive != null) user.isActive = dto.isActive;

    if (dto.role != null) {
      await this.rolesService.assertRoleAssignable(dto.role);
      user.role = dto.role;
      if (dto.role === UserRole.ADMIN) {
        user.designerId = null;
        user.clientId = null;
      }
    }

    if (dto.designerId !== undefined) {
      if (dto.designerId) {
        const designer = await this.designerRepo.findOne({
          where: { id: dto.designerId },
        });
        if (!designer) throw new BadRequestException('Designer not found');
        user.designerId = designer.id;
      } else {
        user.designerId = null;
      }
    }

    if (dto.clientId !== undefined) {
      if (dto.clientId) {
        const client = await this.clientRepo.findOne({
          where: { id: dto.clientId },
        });
        if (!client) throw new BadRequestException('Client not found');
        user.clientId = client.id;
      } else {
        user.clientId = null;
      }
    }

    const effectiveRole = dto.role ?? user.role;
    if (effectiveRole === UserRole.DESIGNER && !user.designerId) {
      throw new BadRequestException(
        'Designer accounts must be linked to a designer profile',
      );
    }
    if (effectiveRole === UserRole.CLIENT && !user.clientId) {
      throw new BadRequestException(
        'Client accounts must be linked to a client profile',
      );
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    await this.userRepo.save(user);
    return this.findUserById(id);
  }

  private async findUserById(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { designer: true, client: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const workContext = await this.loadWorkContext();
    return {
      ...this.serializeAdminUser(user),
      workSummary: this.buildUserWork(user, workContext, false).summary,
    };
  }

  private serializeAdminUser(user: UserWithProfiles) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      designerId: user.designerId,
      clientId: user.clientId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      designer: user.designer
        ? {
            id: user.designer.id,
            name: user.designer.name,
            firm: user.designer.firm,
            email: user.designer.email,
          }
        : null,
      client: user.client
        ? {
            id: user.client.id,
            name: user.client.name,
            email: user.client.email,
          }
        : null,
    };
  }

  private async loadWorkContext(): Promise<WorkContext> {
    const [projects, openQuotes] = await Promise.all([
      this.projectRepo.find({
        where: { isDemo: false },
        order: { updatedAt: 'DESC' },
      }),
      this.quoteRepo.find({
        where: { projectId: IsNull(), isActive: true },
        order: { updatedAt: 'DESC' },
      }),
    ]);
    return { projects, openQuotes };
  }

  private buildUserWork(
    user: UserWithProfiles,
    ctx: WorkContext,
    includeItems: boolean,
  ) {
    const projects = this.projectsForUser(user, ctx.projects);
    const quotes = this.quotesForUser(user, ctx.openQuotes);

    const inProgress = projects.filter(
      (p) => p.status !== ProjectStatus.COMPLETE,
    ).length;
    const finished = projects.filter(
      (p) => p.status === ProjectStatus.COMPLETE,
    ).length;
    const summary: UserWorkSummary = {
      quoted: quotes.length,
      inProgress,
      finished,
    };

    if (!includeItems) {
      return { summary, items: [] as UserWorkItem[] };
    }

    const quoteItems: UserWorkItem[] = quotes.map((q) => ({
      id: q.id,
      kind: 'quote',
      title: this.quoteTitle(q),
      status: q.status,
      statusLabel: QUOTE_STATUS_LABELS[q.status],
      updatedAt: q.updatedAt.toISOString(),
      projectId: null,
      isActive: q.isActive,
    }));

    const projectItems: UserWorkItem[] = projects.map((p) => ({
      id: p.id,
      kind: 'project',
      title: p.name,
      status: p.status,
      statusLabel: PROJECT_STATUS_LABELS[p.status],
      updatedAt: p.updatedAt.toISOString(),
      projectId: p.id,
      isActive: p.isActive,
    }));

    const items = [...quoteItems, ...projectItems].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return { summary, items };
  }

  private projectsForUser(user: UserWithProfiles, allProjects: Project[]) {
    if (user.role === UserRole.DESIGNER && user.designerId) {
      return allProjects.filter((p) => p.designerId === user.designerId);
    }
    if (user.role === UserRole.CLIENT && user.clientId) {
      return allProjects.filter((p) => p.clientId === user.clientId);
    }
    return [];
  }

  private quotesForUser(user: UserWithProfiles, openQuotes: QuoteRequest[]) {
    if (user.role === UserRole.ADMIN) return [];
    const emails = this.emailsForUser(user);
    return openQuotes.filter(
      (q) =>
        emails.has(q.email.toLowerCase()) && q.status !== QuoteStatus.DECLINED,
    );
  }

  private emailsForUser(user: UserWithProfiles) {
    const emails = new Set<string>();
    emails.add(user.email.toLowerCase());
    if (user.designer?.email) emails.add(user.designer.email.toLowerCase());
    if (user.client?.email) emails.add(user.client.email.toLowerCase());
    return emails;
  }

  private quoteTitle(quote: QuoteRequest) {
    const place = quote.propertyAddress?.split(',')[0]?.trim();
    if (place) return `${quote.contactName} — ${place}`;
    return `${quote.contactName} — ${quote.serviceType}`;
  }

  private async createDesignerProfile(
    email: string,
    dto: NonNullable<CreateAdminUserDto['newDesigner']>,
  ) {
    const existingDesigner = await this.designerRepo.findOne({
      where: { email },
    });
    if (existingDesigner) {
      throw new ConflictException('A designer with this email already exists');
    }
    return this.designerRepo.save(
      this.designerRepo.create({
        name: dto.name,
        firm: dto.firm,
        email,
        phone: dto.phone,
        city: dto.city,
      }),
    );
  }

  private async createClientProfile(
    name: string,
    email: string,
    dto: NonNullable<CreateAdminUserDto['newClient']>,
  ) {
    const existingClient = await this.clientRepo.findOne({ where: { email } });
    if (existingClient) {
      throw new ConflictException('A client with this email already exists');
    }
    return this.clientRepo.save(
      this.clientRepo.create({
        name,
        email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
      }),
    );
  }

  private async recalculateQuoteEstimate(quote: QuoteRequest) {
    if (!quote.rooms?.length) return;

    const rates = await this.settingsService.resolveQuotePricing(quote);
    const catalog = await this.catalogRepo.find();
    const result = calculateQuoteEstimate(
      {
        rooms: quote.rooms,
        milesToStorage: quote.milesToStorage,
        milesToInstall: quote.milesToInstall,
        storageMonths: quote.storageMonths,
        storageType: quote.storageType,
        pickupLocationCount: quote.pickupLocationCount,
      },
      catalog.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        pickupFee: Number(c.pickupFee),
        storageFeeMonthly: Number(c.storageFeeMonthly),
        installFee: Number(c.installFee),
      })),
      rates,
    );

    quote.lineItems = result.lineItems;
    quote.estimatedTotal = result.estimatedTotal;
    quote.estimatedPieces = result.totalPieces;
  }
}
