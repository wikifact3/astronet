import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
