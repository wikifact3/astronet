import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  provider: (process.env.SMS_PROVIDER || 'dev-logger') as 'dev-logger' | 'sparrow',
  devMode: (process.env.SMS_DEV_MODE || 'true').toLowerCase() === 'true',

  sparrow: {
    // Sparrow uses a token-based auth. Get it from the Sparrow dashboard.
    token: process.env.SPARROW_SMS_TOKEN || '',
    // The registered sender identity (alphanumeric, e.g. "PowerLink")
    from: process.env.SPARROW_SMS_FROM || 'PowerLink',
    // Sparrow API base URL (they have a standard endpoint)
    baseUrl: process.env.SPARROW_SMS_BASE_URL || 'http://api.sparrowsms.com/v2',
    timeoutMs: parseInt(process.env.SPARROW_SMS_TIMEOUT_MS || '10000', 10),
  },

  // Fallback: if the real gateway fails, log to console so nothing is lost
  fallbackToLogger: (process.env.SMS_FALLBACK_TO_LOGGER || 'true').toLowerCase() === 'true',
}));
