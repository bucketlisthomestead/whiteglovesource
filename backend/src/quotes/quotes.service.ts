import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { QuoteRequest } from '../entities/quote-request.entity';
import { CreateQuoteDto } from '../common/dto';
import {
  CompleteQuoteDto,
  CreateQuoteLeadDto,
  QuoteEstimateDto,
} from '../common/quote.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CatalogService } from '../catalog/catalog.service';
import { MileageService } from '../mileage/mileage.service';
import { calculateQuoteEstimate } from '../common/quote-pricing';
import { QuoteStatus, StorageType } from '../common/enums';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(QuoteRequest)
    private readonly quoteRepo: Repository<QuoteRequest>,
    private readonly emailService: EmailService,
    private readonly catalogService: CatalogService,
    private readonly mileageService: MileageService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
  ) {}

  async estimate(dto: QuoteEstimateDto) {
    const catalog = await this.catalogService.findAll();
    const mileage = await this.mileageService.calculateMileage(
      dto.pickupAddress,
      dto.propertyAddress,
    );
    const rates = await this.settingsService.getPricingRates();

    const result = calculateQuoteEstimate(
      {
        rooms: dto.rooms,
        milesToStorage: mileage.milesToStorage,
        milesToInstall: mileage.milesToInstall,
        storageMonths: dto.storageMonths,
        storageType: dto.storageType,
        pickupLocationCount: dto.pickupLocationCount,
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

    return {
      ...result,
      storageLocationId: mileage.storageLocationId,
      storageLocationName: mileage.storageLocationName,
      mileageNote: mileage.mileageNote,
    };
  }

  async createLead(dto: CreateQuoteLeadDto) {
    const quote = this.quoteRepo.create({
      contactName: dto.contactName,
      email: dto.email,
      phone: dto.phone ?? null,
      company: dto.company ?? null,
      serviceType: dto.serviceType,
      projectDescription: 'Quote builder in progress — contact captured',
      status: QuoteStatus.LEAD,
    } as Partial<QuoteRequest>);
    const saved = await this.quoteRepo.save(quote);
    await this.emailService.notifyOwnerQuoteLead(dto).catch(() => {});
    await this.notificationsService.notifyQuoteLead(saved).catch(() => {});
    return saved;
  }

  async completeLead(id: string, dto: CompleteQuoteDto) {
    const quote = await this.quoteRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.LEAD) {
      throw new BadRequestException('This quote has already been submitted');
    }

    const rooms = dto.rooms || [];
    if (rooms.length === 0) {
      throw new BadRequestException('Add at least one piece to submit');
    }

    const estimate = await this.estimate({
      rooms,
      pickupAddress: dto.pickupAddress,
      propertyAddress: dto.propertyAddress,
      storageMonths: dto.storageMonths ?? 1,
      storageType: dto.storageType ?? StorageType.STANDARD_CLIMATE,
      pickupLocationCount: dto.pickupLocationCount ?? 1,
    });

    const projectDescription =
      dto.projectDescription?.trim() ||
      this.buildDescriptionSummary(rooms, {
        milesToStorage: estimate.milesToStorage,
        milesToInstall: estimate.milesToInstall,
        storageMonths: dto.storageMonths,
      } as CreateQuoteDto);

    Object.assign(quote, {
      projectDescription,
      propertyAddress: dto.propertyAddress ?? null,
      pickupAddress: dto.pickupAddress ?? null,
      preferredDate: dto.preferredDate ?? null,
      rooms,
      lineItems: estimate.lineItems,
      estimatedTotal: estimate.estimatedTotal,
      estimatedPieces: estimate.totalPieces,
      milesToStorage: estimate.milesToStorage,
      milesToInstall: estimate.milesToInstall,
      storageMonths: dto.storageMonths ?? 1,
      storageType: dto.storageType ?? StorageType.STANDARD_CLIMATE,
      pickupLocationCount: dto.pickupLocationCount ?? 1,
      storageLocationId: estimate.storageLocationId ?? null,
      storageLocationName: estimate.storageLocationName ?? null,
      status: QuoteStatus.PENDING,
    });

    const saved = await this.quoteRepo.save(quote);
    await this.emailService
      .notifyOwnerQuote({
        contactName: quote.contactName,
        email: quote.email,
        phone: quote.phone ?? undefined,
        company: quote.company ?? undefined,
        serviceType: quote.serviceType,
        projectDescription,
        propertyAddress: quote.propertyAddress ?? undefined,
        pickupAddress: quote.pickupAddress ?? undefined,
        estimatedPieces: quote.estimatedPieces ?? undefined,
        preferredDate: quote.preferredDate ?? undefined,
        estimatedTotal: Number(quote.estimatedTotal),
        milesToStorage: quote.milesToStorage,
        milesToInstall: quote.milesToInstall,
        storageMonths: quote.storageMonths,
        storageLocationName: quote.storageLocationName ?? undefined,
      })
      .catch(() => {});
    await this.notificationsService.notifyQuoteSubmitted(saved).catch(() => {});
    return saved;
  }

  async create(dto: CreateQuoteDto) {
    const rooms = dto.rooms || [];
    let estimatedTotal: number | undefined;
    let lineItems;
    let estimatedPieces = dto.estimatedPieces;
    let milesToStorage = 0;
    let milesToInstall = 0;
    let storageLocationId: string | null = null;
    let storageLocationName: string | null = null;

    if (rooms.length > 0) {
      const estimate = await this.estimate({
        rooms,
        pickupAddress: dto.pickupAddress,
        propertyAddress: dto.propertyAddress,
        storageMonths: dto.storageMonths ?? 1,
        storageType: dto.storageType ?? StorageType.STANDARD_CLIMATE,
        pickupLocationCount: dto.pickupLocationCount ?? 1,
      });
      estimatedTotal = estimate.estimatedTotal;
      lineItems = estimate.lineItems;
      estimatedPieces = estimate.totalPieces;
      milesToStorage = estimate.milesToStorage;
      milesToInstall = estimate.milesToInstall;
      storageLocationId = estimate.storageLocationId ?? null;
      storageLocationName = estimate.storageLocationName ?? null;
    }

    const projectDescription =
      dto.projectDescription?.trim() ||
      this.buildDescriptionSummary(rooms, {
        ...dto,
        milesToStorage,
        milesToInstall,
      });

    const quote = this.quoteRepo.create({
      contactName: dto.contactName,
      email: dto.email,
      phone: dto.phone ?? null,
      company: dto.company ?? null,
      serviceType: dto.serviceType,
      projectDescription,
      propertyAddress: dto.propertyAddress ?? null,
      pickupAddress: dto.pickupAddress ?? null,
      preferredDate: dto.preferredDate ?? null,
      rooms: rooms.length > 0 ? rooms : undefined,
      lineItems: lineItems ?? undefined,
      estimatedTotal: estimatedTotal ?? null,
      estimatedPieces: estimatedPieces ?? null,
      milesToStorage,
      milesToInstall,
      storageMonths: dto.storageMonths ?? 1,
      storageType: dto.storageType ?? StorageType.STANDARD_CLIMATE,
      pickupLocationCount: dto.pickupLocationCount ?? 1,
      storageLocationId,
      storageLocationName,
    } as Partial<QuoteRequest>);
    const saved = await this.quoteRepo.save(quote);
    await this.emailService
      .notifyOwnerQuote({
        ...dto,
        projectDescription,
        estimatedTotal,
        milesToStorage,
        milesToInstall,
        storageLocationName: storageLocationName ?? undefined,
      })
      .catch(() => {});
    await this.notificationsService.notifyQuoteSubmitted(saved).catch(() => {});
    return saved;
  }

  findAll() {
    return this.quoteRepo.find({
      where: { projectId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string) {
    return this.quoteRepo.findOne({ where: { id } });
  }

  private buildDescriptionSummary(
    rooms: CreateQuoteDto['rooms'],
    dto: CreateQuoteDto,
  ) {
    const roomCount = rooms?.length ?? 0;
    const pieceCount =
      rooms?.reduce(
        (sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0),
        0,
      ) ?? 0;
    const parts = [
      `${roomCount} room(s), ${pieceCount} catalogued piece(s)`,
      dto.milesToStorage ? `${dto.milesToStorage} mi pickup → warehouse` : null,
      dto.milesToInstall
        ? `${dto.milesToInstall} mi warehouse → install`
        : null,
      dto.storageMonths ? `${dto.storageMonths} mo storage` : null,
    ].filter(Boolean);
    return parts.join(' · ') || 'Quote builder submission';
  }
}
