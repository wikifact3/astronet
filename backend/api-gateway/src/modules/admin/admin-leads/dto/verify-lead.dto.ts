import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
