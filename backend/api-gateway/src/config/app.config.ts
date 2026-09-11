import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'PowerLink API',
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  otpExpiresIn: parseInt(process.env.OTP_EXPIRES_IN || '300', 10),
  otpRateLimit: parseInt(process.env.OTP_RATE_LIMIT || '5', 10),
}));
