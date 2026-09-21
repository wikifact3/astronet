import { registerAs } from '@nestjs/config';

export default registerAs('logging', () => ({
  level: process.env.LOG_LEVEL || 'info',
  pretty: (process.env.LOG_PRETTY || 'true').toLowerCase() === 'true',
  // Redact sensitive fields from all logs
  redactPaths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.otp',
    'req.body.token',
    'req.body.refreshToken',
    'res.headers["set-cookie"]',
  ],
}));
