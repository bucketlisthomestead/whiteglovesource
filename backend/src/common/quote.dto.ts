import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType } from './enums';

/** Step 1 — contact info captured immediately as a sales lead */
export class CreateQuoteLeadDto {
  @IsString()
  contactName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsString()
  serviceType: string;
}

/** Steps 2–3 — complete an existing lead quote */
export class CompleteQuoteDto {
  @IsOptional()
  @IsString()
  projectDescription?: string;

  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageMonths?: number;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType;

  @IsOptional()
  @IsInt()
  @Min(1)
  pickupLocationCount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRoomDto)
  rooms: QuoteRoomDto[];
}

export class QuoteRoomItemDto {
  @IsUUID()
  catalogItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class QuoteRoomDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRoomItemDto)
  items: QuoteRoomItemDto[];
}

export class QuoteEstimateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRoomDto)
  rooms: QuoteRoomDto[];

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @IsInt()
  @Min(0)
  storageMonths: number;

  @IsEnum(StorageType)
  storageType: StorageType;

  @IsInt()
  @Min(1)
  pickupLocationCount: number;
}
