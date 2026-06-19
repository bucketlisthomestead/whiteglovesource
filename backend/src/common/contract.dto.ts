import { IsIn, IsString, MaxLength } from 'class-validator';

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
