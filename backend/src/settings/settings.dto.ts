import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAppSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  businessName?: string;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessZip?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  projectBaseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalPickupSurcharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuote?: number;

  @IsOptional()
  @IsBoolean()
  allowDigitalSignatures?: boolean;
}
