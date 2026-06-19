import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_SETTINGS_ID, AppSettings } from '../entities/app-settings.entity';
import { PRICING_RATES } from '../common/quote-pricing';
import { UpdateAppSettingsDto } from './settings.dto';

export interface AppSettingsDto {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  businessCity: string | null;
  businessState: string | null;
  businessZip: string | null;
  mileRate: number;
  projectBaseFee: number;
  additionalPickupSurcharge: number;
  minimumQuote: number;
  allowDigitalSignatures: boolean;
  updatedAt: string;
}

export type PricingRates = typeof PRICING_RATES;

export type QuotePricingOverrides = {
  mileRate?: number | null;
  projectBaseFee?: number | null;
  additionalPickupSurcharge?: number | null;
  minimumQuote?: number | null;
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly settingsRepo: Repository<AppSettings>,
  ) {}

  async getSettings(): Promise<AppSettingsDto> {
    const row = await this.getOrCreateRow();
    return this.serialize(row);
  }

  async updateSettings(dto: UpdateAppSettingsDto): Promise<AppSettingsDto> {
    const row = await this.getOrCreateRow();
    if (dto.businessName != null) row.businessName = dto.businessName;
    if (dto.businessEmail != null) row.businessEmail = dto.businessEmail;
    if (dto.businessPhone != null) row.businessPhone = dto.businessPhone;
    if (dto.businessAddress != null) row.businessAddress = dto.businessAddress;
    if (dto.businessCity !== undefined)
      row.businessCity = dto.businessCity || null;
    if (dto.businessState !== undefined)
      row.businessState = dto.businessState || null;
    if (dto.businessZip !== undefined)
      row.businessZip = dto.businessZip || null;
    if (dto.mileRate != null) row.mileRate = dto.mileRate;
    if (dto.projectBaseFee != null) row.projectBaseFee = dto.projectBaseFee;
    if (dto.additionalPickupSurcharge != null) {
      row.additionalPickupSurcharge = dto.additionalPickupSurcharge;
    }
    if (dto.minimumQuote != null) row.minimumQuote = dto.minimumQuote;
    if (dto.allowDigitalSignatures != null)
      row.allowDigitalSignatures = dto.allowDigitalSignatures;
    const saved = await this.settingsRepo.save(row);
    return this.serialize(saved);
  }

  async getPricingRates(): Promise<PricingRates> {
    const row = await this.getOrCreateRow();
    return {
      ...PRICING_RATES,
      mileRate: Number(row.mileRate),
      projectBaseFee: Number(row.projectBaseFee),
      additionalPickupSurcharge: Number(row.additionalPickupSurcharge),
      minimumQuote: Number(row.minimumQuote),
    };
  }

  async resolveQuotePricing(
    overrides?: QuotePricingOverrides,
  ): Promise<PricingRates> {
    const base = await this.getPricingRates();
    return {
      ...base,
      mileRate:
        overrides?.mileRate != null
          ? Number(overrides.mileRate)
          : base.mileRate,
      projectBaseFee:
        overrides?.projectBaseFee != null
          ? Number(overrides.projectBaseFee)
          : base.projectBaseFee,
      additionalPickupSurcharge:
        overrides?.additionalPickupSurcharge != null
          ? Number(overrides.additionalPickupSurcharge)
          : base.additionalPickupSurcharge,
      minimumQuote:
        overrides?.minimumQuote != null
          ? Number(overrides.minimumQuote)
          : base.minimumQuote,
    };
  }

  private async getOrCreateRow(): Promise<AppSettings> {
    let row = await this.settingsRepo.findOne({
      where: { id: APP_SETTINGS_ID },
    });
    if (!row) {
      row = this.settingsRepo.create({
        id: APP_SETTINGS_ID,
        businessName: 'White Glove Source',
        businessEmail: 'hello@whiteglovedeliverync.com',
        businessPhone: '(336) 555-0100',
        businessAddress: 'High Point, NC',
        businessCity: 'High Point',
        businessState: 'NC',
        businessZip: null,
        mileRate: PRICING_RATES.mileRate,
        projectBaseFee: PRICING_RATES.projectBaseFee,
        additionalPickupSurcharge: PRICING_RATES.additionalPickupSurcharge,
        minimumQuote: PRICING_RATES.minimumQuote,
        allowDigitalSignatures: false,
      });
      row = await this.settingsRepo.save(row);
    }
    return row;
  }

  private serialize(row: AppSettings): AppSettingsDto {
    return {
      businessName: row.businessName,
      businessEmail: row.businessEmail,
      businessPhone: row.businessPhone,
      businessAddress: row.businessAddress,
      businessCity: row.businessCity,
      businessState: row.businessState,
      businessZip: row.businessZip,
      mileRate: Number(row.mileRate),
      projectBaseFee: Number(row.projectBaseFee),
      additionalPickupSurcharge: Number(row.additionalPickupSurcharge),
      minimumQuote: Number(row.minimumQuote),
      allowDigitalSignatures: row.allowDigitalSignatures ?? false,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
