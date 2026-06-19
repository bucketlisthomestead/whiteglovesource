import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from './roles';
import { StorageType, ProjectStatus } from './enums';

export class CreateDesignerInputDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  firm: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateClientInputDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsUUID()
  designerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDesignerInputDto)
  newDesigner?: CreateDesignerInputDto;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientInputDto)
  newClient?: CreateClientInputDto;

  @IsString()
  propertyAddress: string;

  @IsOptional()
  @IsString()
  propertyCity?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  targetInstallDate?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

export class CreateProjectFromQuoteDto {
  @IsOptional()
  @IsUUID()
  designerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDesignerInputDto)
  newDesigner?: CreateDesignerInputDto;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientInputDto)
  newClient?: CreateClientInputDto;
}

export class AdminUpdateQuoteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

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
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPieces?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quotedAmount?: number;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  milesToStorage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  milesToInstall?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  storageMonths?: number;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pickupLocationCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileRate?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  projectBaseFee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalPickupSurcharge?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuote?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStorageLocationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStorageLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Designer profile only — login password comes from CreateAdminUserDto.password */
export class CreateDesignerProfileDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  firm: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

/** Client profile only — login email/password come from CreateAdminUserDto */
export class CreateClientProfileDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

export class CreateAdminUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role: string;

  @IsOptional()
  @IsUUID()
  designerId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDesignerProfileDto)
  newDesigner?: CreateDesignerProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientProfileDto)
  newClient?: CreateClientProfileDto;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsUUID()
  designerId?: string | null;

  @IsOptional()
  @IsUUID()
  clientId?: string | null;
}
