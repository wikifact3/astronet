import { registerAs } from '@nestjs/config';

export default registerAs('kyc', () => ({
  maxFileBytes: parseInt(process.env.KYC_MAX_FILE_BYTES || '5242880', 10),
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  sessionTtlMinutes: parseInt(process.env.KYC_SESSION_TTL_MINUTES || '30', 10),
  signedUrlTtlSeconds: parseInt(process.env.KYC_SIGNED_URL_TTL_SECONDS || '300', 10),
  scanStubDelayMs: parseInt(process.env.KYC_SCAN_STUB_DELAY_MS || '5000', 10),
  maxDocumentsPerAccount: parseInt(process.env.KYC_MAX_DOCS_PER_ACCOUNT || '10', 10),
}));
