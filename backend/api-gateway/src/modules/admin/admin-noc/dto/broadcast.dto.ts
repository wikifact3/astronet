import { IsString, IsOptional, IsEnum, IsArray, MinLength, MaxLength } from 'class-validator';

export enum BroadcastCategory {
  MAINTENANCE = 'maintenance',
  OUTAGE = 'outage',
  PROMOTION = 'promotion',
  GENERAL = 'general',
}

export class BroadcastDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wards?: string[];
  

  @IsString()
  @MinLength(5)
  @MaxLength(400)
  message: string;

  @IsEnum(BroadcastCategory)
  category: BroadcastCategory;
}
