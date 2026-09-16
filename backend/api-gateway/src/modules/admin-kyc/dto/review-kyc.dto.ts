import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum KycReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export enum KycReviewReasonCode {
  DOCUMENT_CLEAR = 'document_clear',
  DOCUMENT_ILLEGIBLE = 'document_illegible',
  DOCUMENT_EXPIRED = 'document_expired',
  ID_MISMATCH = 'id_mismatch',
  ADDRESS_MISMATCH = 'address_mismatch',
  INCOMPLETE_DOCUMENT = 'incomplete_document',
  OTHER = 'other',
}

export class ReviewKycDto {
  @IsEnum(KycReviewAction)
  action: KycReviewAction;

  @IsEnum(KycReviewReasonCode)
  reasonCode: KycReviewReasonCode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
