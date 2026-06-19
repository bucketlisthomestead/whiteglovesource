import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProjectPhase } from './enums';

export class SaveProjectPdfDto {
  @IsIn(['inventory', 'status_full', 'status_phase'])
  documentType: 'inventory' | 'status_full' | 'status_phase';

  @IsOptional()
  @IsEnum(ProjectPhase)
  phase?: ProjectPhase;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
