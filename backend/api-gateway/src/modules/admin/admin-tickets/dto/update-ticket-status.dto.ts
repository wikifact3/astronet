import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketStatus } from '../../../../database/entities/ticket.entity';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
