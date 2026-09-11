import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateLeadDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ward?: string;
}
