import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType } from './enums';
import { QuoteRoomDto } from './quote.dto';

export class CreateContactDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;
}

export class CreateQuoteDto {
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

  @IsOptional()
  @IsString()
  projectDescription?: string;

  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedPieces?: number;

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  milesToStorage?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  milesToInstall?: number;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRoomDto)
  rooms?: QuoteRoomDto[];
}

export class CreatePieceEventDto {
  @IsString()
  stage: string;

  @IsString()
  condition: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  photoMilestone?: string;
}
