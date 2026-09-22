import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
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

export function randomPhone(): string {
  const suffix = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
  return `980000${suffix}`;
}

export function randomEmail(): string {
  return `test-${Date.now()}-${Math.floor(Math.random() * 10_000)}@powerlink.test`;
}

/**
 * Logs in as the seeded SUPER_ADMIN and returns a Bearer token.
 */
export async function adminLogin(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/admin/auth/login')
    .send({ email: 'admin@powerlink.com.np', password: 'ChangeMe123!' });
  if (!res.body.accessToken) {
    throw new Error(
      `Admin login failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return res.body.accessToken;
}

/**
 * Creates a customer + account + active subscription + a plan subscription
 * ready for tests. Returns IDs and the access token.
 */
export async function seedActiveCustomer(
  app: INestApplication,
  db: DataSource,
  opts?: { ward?: string },
): Promise<{
  phone: string;
  customerId: string;
  accountId: string;
  subscriptionId: string;
  accessToken: string;
}> {
  const phone = randomPhone();

  const cust = await db.query(
    `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
     VALUES ($1, 'Test User', 'approved') RETURNING id`,
    [phone],
  );
  const customerId = cust[0].id;

  const installationAddress = opts?.ward
    ? {
        province: 'Bagmati',
        district: 'Kathmandu',
        municipality: 'Kathmandu',
        ward: opts.ward,
      }
    : null;

  const acct = await db.query(
    `INSERT INTO powerlink_core.accounts (customer_id, account_type, status, installation_address)
     VALUES ($1, 'retail', 'active', $2::jsonb) RETURNING id`,
    [customerId, installationAddress ? JSON.stringify(installationAddress) : null],
  );
  const accountId = acct[0].id;

  const plan = await db.query(
    `SELECT id FROM powerlink_core.plans WHERE name = 'Fiber Standard' LIMIT 1`,
  );
  const planId = plan[0].id;

  const sub = await db.query(
    `INSERT INTO powerlink_core.subscriptions
       (account_id, plan_id, status, validity_start, validity_end)
     VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
     RETURNING id`,
    [accountId, planId],
  );
  const subscriptionId = sub[0].id;

  // Log in
  await request(app.getHttpServer())
    .post('/v1/auth/otp/request')
    .send({ phone });

  let otp = '';
  for (let i = 0; i < 10 && !otp; i++) {
    const rows = await db.query(
      `SELECT code FROM powerlink_core.otp_codes
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    if (rows.length > 0) otp = rows[0].code;
    else await new Promise((r) => setTimeout(r, 50));
  }
  if (!otp) throw new Error(`No OTP for ${phone}`);

  const verify = await request(app.getHttpServer())
    .post('/v1/auth/otp/verify')
    .send({ phone, otp });

  return {
    phone,
    customerId,
    accountId,
    subscriptionId,
    accessToken: verify.body.accessToken,
  };
}

/**
 * Removes all test-created data for a phone. Cascade-safe.
 */
export async function cleanupTestPhone(
  db: DataSource,
  phone: string,
): Promise<void> {
  await db.query(
    `DELETE FROM powerlink_core.ticket_messages
     WHERE ticket_id IN (
       SELECT t.id FROM powerlink_core.tickets t
       JOIN powerlink_core.accounts a ON a.id = t.account_id
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.tickets
     WHERE account_id IN (
       SELECT a.id FROM powerlink_core.accounts a
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
  await db.query(
    `DELETE FROM powerlink_core.cancellation_requests
     WHERE account_id IN (
       SELECT a.id FROM powerlink_core.accounts a
       JOIN powerlink_core.customers c ON c.id = a.customer_id
       WHERE c.phone = $1)`,
    [phone],
  );
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
  await db.query(`DELETE FROM powerlink_core.otp_request_log WHERE phone = $1`, [phone]);
  await db.query(`DELETE FROM powerlink_core.otp_codes WHERE phone = $1`, [phone]);
  await db.query(`DELETE FROM powerlink_core.customers WHERE phone = $1`, [phone]);
}

/**
 * Cleanup for tests that created leads (phone + reference).
 */
export async function cleanupTestLead(db: DataSource, phone: string): Promise<void> {
  await db.query(
    `DELETE FROM powerlink_core.leads WHERE phone = $1`,
    [phone],
  );
}
