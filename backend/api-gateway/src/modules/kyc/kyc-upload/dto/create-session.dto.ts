import { IsEnum } from 'class-validator';

export enum KycDocumentType {
  CITIZENSHIP_FRONT = 'citizenship_front',
  CITIZENSHIP_BACK = 'citizenship_back',
  PASSPORT = 'passport',
  UTILITY_BILL = 'utility_bill',
  OTHER = 'other',
}

export class CreateKycSessionDto {
  @IsEnum(KycDocumentType)
  documentType: KycDocumentType;
}
