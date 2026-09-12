import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^(98|97|96)\d{8}$/, {
    message: 'phone must be a valid 10-digit Nepali mobile number',
  })
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be 6 digits' })
  otp: string;
}
