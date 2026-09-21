import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('v1');
  await app.init();
  return app;
}

/**
 * 10-digit Nepali mobile number for tests. Uses the 980000 prefix
 * reserved for test data, plus 4 random digits → 10 total.
 * Format: 98 00 00 XXXX = 980000XXXX
 */
export function randomPhone(): string {
  const suffix = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
  return `980000${suffix}`; // 6 + 4 = 10 digits
}

export function randomEmail(): string {
  return `test-${Date.now()}-${Math.floor(Math.random() * 10_000)}@powerlink.test`;
}

export async function cleanupTestPhone(
  db: DataSource,
  phone: string,
): Promise<void> {
  await db.query(`DELETE FROM powerlink_core.otp_request_log WHERE phone = $1`, [phone]);
  await db.query(`DELETE FROM powerlink_core.otp_codes WHERE phone = $1`, [phone]);
  await db.query(
    `DELETE FROM powerlink_core.kyc_documents
     WHERE account_id IN (
       SELECT a.id FROM powerlink_core.accounts a
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.payments
     WHERE invoice_id IN (
       SELECT i.id FROM powerlink_core.invoices i
       JOIN powerlink_core.accounts a ON a.id = i.account_id
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.invoices
     WHERE account_id IN (
       SELECT a.id FROM powerlink_core.accounts a
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.subscriptions
     WHERE account_id IN (
       SELECT a.id FROM powerlink_core.accounts a
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.accounts
     WHERE customer_id IN (
       SELECT id FROM powerlink_core.customers WHERE phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.refresh_tokens
     WHERE customer_id IN (
       SELECT id FROM powerlink_core.customers WHERE phone = $1)`,
    [phone],
  );
  await db.query(`DELETE FROM powerlink_core.customers WHERE phone = $1`, [phone]);
}
