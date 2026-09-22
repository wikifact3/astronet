import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export enum AdjustmentKind {
  CHARGE = 'charge',
  CREDIT = 'credit',
  REFUND = 'refund',
}

export class ManualAdjustmentDto {
  @IsUUID()
  accountId: string;

  @IsEnum(AdjustmentKind)
  kind: AdjustmentKind;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsUUID()
  originalInvoiceId?: string;
}

