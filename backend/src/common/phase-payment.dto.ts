import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PhasePaymentStatus } from './enums';

export class UpdatePhasePaymentDto {
  @IsEnum(PhasePaymentStatus)
  status: PhasePaymentStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountExpected?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
