import { IsString, MinLength, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class StaffReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
