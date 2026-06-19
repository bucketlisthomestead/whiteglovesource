import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectMessageDto {
  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
