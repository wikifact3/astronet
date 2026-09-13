import { registerAs } from '@nestjs/config';

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (!Number.isNaN(n) && Number.isInteger(n) && n >= 0) return n;
  return raw;
}

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'PowerLink API',
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),

  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),

  // Where to send users who try to log in but aren't registered yet.
  marketingApplyUrl:
    process.env.MARKETING_APPLY_URL || 'http://localhost:3000/en/connect',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me-in-production',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    issuer: 'powerlink.com.np',
    audience: 'powerlink-clients',
  },

  otp: {
    length: 6,
    expiresInSeconds: parseInt(process.env.OTP_EXPIRES_IN || '300', 10),
    devMode: (process.env.NODE_ENV || 'development') !== 'production',
    maxAttempts: 5,
    rateLimits: {
      perPhonePerHour: parseInt(process.env.OTP_PHONE_LIMIT || '5', 10),
      perIpPerHour: parseInt(process.env.OTP_IP_LIMIT || '20', 10),
      globalPerHour: parseInt(process.env.OTP_GLOBAL_LIMIT || '500', 10),
    },
  },
}));