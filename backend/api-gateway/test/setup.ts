// Jest setup file. Runs before each test file.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_PRETTY = 'false';
process.env.SMS_PROVIDER = 'dev-logger';
process.env.LEADS_AUTO_PROMOTE = 'true';
process.env.PAYMENT_PROVIDER_MODE = 'stub';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
