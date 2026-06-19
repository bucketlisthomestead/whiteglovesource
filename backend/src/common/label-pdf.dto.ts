import { IsIn, IsOptional, IsString } from 'class-validator';
import { LABEL_SHEET_TEMPLATES } from './label-sizes';

const TEMPLATE_IDS = LABEL_SHEET_TEMPLATES.map((t) => t.id);

export class GenerateLabelPdfDto {
  @IsOptional()
  @IsString()
  @IsIn(TEMPLATE_IDS)
  templateId?: string;
}
