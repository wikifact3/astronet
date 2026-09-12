import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'PowerLink API',
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),

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
    maxRequestsPerHour: parseInt(process.env.OTP_RATE_LIMIT || '5', 10),
    devMode: (process.env.NODE_ENV || 'development') !== 'production',
  },
}));
