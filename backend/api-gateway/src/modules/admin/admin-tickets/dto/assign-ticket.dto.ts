import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignTicketDto {
  @IsUUID()
  staffId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
