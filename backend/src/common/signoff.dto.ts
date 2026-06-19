import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PhotoMilestone, SignoffType, SignerRole } from './signoff';
import { ProjectPhase } from './enums';

export class CreateSignoffDto {
  @IsUUID()
  projectId: string;

  @IsEnum(SignoffType)
  signoffType: SignoffType;

  @IsEnum(SignerRole)
  signerRole: SignerRole;

  @IsOptional()
  @IsUUID()
  pieceId?: string;

  @IsOptional()
  @IsEnum(PhotoMilestone)
  milestone?: PhotoMilestone;

  @IsOptional()
  @IsEnum(ProjectPhase)
  phase?: ProjectPhase;

  @IsOptional()
  @IsString()
  notes?: string;
}
