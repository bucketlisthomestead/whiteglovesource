import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class CaptureContractSignatureDto {
  @IsIn(['admin', 'client'])
  role: 'admin' | 'client';

  @IsString()
  @MaxLength(255)
  signerName: string;

  /** Base64 data URL (image/png) of canvas signature */
  @IsString()
  signatureDataUrl: string;
}

export class GenerateContractAmendmentDto {
  @IsUUID()
  quoteId: string;
}
