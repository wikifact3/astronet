import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountStatus } from '../../../../database/entities/account.entity';

export class TransitionStatusDto {
  @IsEnum(AccountStatus)
  toStatus: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
