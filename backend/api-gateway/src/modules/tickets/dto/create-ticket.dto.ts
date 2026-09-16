import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TicketCategory } from '../../../database/entities/ticket.entity';

export class CreateTicketDto {
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  firstMessage?: string;
}
