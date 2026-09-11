import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLeadDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(98|97|96)\d{8}$/, {
    message: 'phone must be a valid Nepali mobile number',
  })
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  gpsLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  gpsLng?: number;

  @IsOptional()
  @IsUUID()
  preferredPlanId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
