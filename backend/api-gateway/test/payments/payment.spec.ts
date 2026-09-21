import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createTestApp, randomPhone, cleanupTestPhone } from '../helpers/test-app';
import { createHmac } from 'crypto';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const phonesUsed: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    for (const phone of phonesUsed) {
      await cleanupTestPhone(db, phone);
    }
    await app.close();
  });

  async function seedCustomerWithInvoice(): Promise<{
    phone: string;
    accessToken: string;
    invoiceId: string;
  }> {
    const phone = randomPhone();
    phonesUsed.push(phone);

    const cust = await db.query(
      `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
       VALUES ($1, 'Payment Test', 'approved') RETURNING id`,
      [phone],
    );
    const customerId = cust[0].id;

    const acct = await db.query(
      `INSERT INTO powerlink_core.accounts (customer_id, account_type, status)
       VALUES ($1, 'retail', 'active') RETURNING id`,
      [customerId],
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

    const inv = await db.query(
      `INSERT INTO powerlink_core.invoices
        (account_id, subscription_id, invoice_number, amount, vat_amount, tsc_amount, total_amount,
         status, issued_at, due_date)
       VALUES ($1, $2, $3, 2500, 325, 25, 2850, 'issued', NOW(), CURRENT_DATE + INTERVAL '30 days')
       RETURNING id`,
      [accountId, subscriptionId, `TEST-${Date.now()}`],
    );

    // Login
    const otpRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone });

    if (otpRes.status !== 200 || otpRes.body.status !== 'sent') {
      throw new Error(
        `OTP request failed for ${phone}: status=${otpRes.status} body=${JSON.stringify(otpRes.body)}`,
      );
    }

    // Read the OTP. Retry briefly in case of read-after-write lag.
    let otpRows: Array<{ code: string }> = [];
    for (let i = 0; i < 10 && otpRows.length === 0; i++) {
      otpRows = await db.query(
        `SELECT code FROM powerlink_core.otp_codes
         WHERE phone = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [phone],
      );
      if (otpRows.length === 0) await new Promise((r) => setTimeout(r, 50));
    }

    if (otpRows.length === 0) {
      const allRows = await db.query(
        `SELECT id, phone, code, consumed_at, created_at
         FROM powerlink_core.otp_codes WHERE phone = $1
         ORDER BY created_at DESC LIMIT 5`,
        [phone],
      );
      throw new Error(
        `No OTP row for ${phone}. Existing rows: ${JSON.stringify(allRows)}`,
      );
    }

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone, otp: otpRows[0].code });

    if (!verify.body.accessToken) {
      throw new Error(
        `OTP verify failed for ${phone}: status=${verify.status} body=${JSON.stringify(verify.body)}`,
      );
    }

    return {
      phone,
      accessToken: verify.body.accessToken,
      invoiceId: inv[0].id,
    };
  }

  it('initiates a payment and returns a redirect URL', async () => {
    const { accessToken, invoiceId } = await seedCustomerWithInvoice();

    const res = await request(app.getHttpServer())
      .post('/v1/payments/esewa/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `test-initiate-${Date.now()}`)
      .send({ invoiceId })
      .expect(200);

    expect(res.body.paymentId).toBeTruthy();
    expect(res.body.redirectUrl).toContain('stub-checkout');
  });

  it('processes a signed webhook and marks the invoice paid', async () => {
    const { accessToken, invoiceId } = await seedCustomerWithInvoice();

    const initiate = await request(app.getHttpServer())
      .post('/v1/payments/esewa/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `test-webhook-${Date.now()}`)
      .send({ invoiceId })
      .expect(200);

    const paymentId = initiate.body.paymentId;

    const payload = JSON.stringify({
      paymentId,
      providerTxnId: `TEST-TXN-${Date.now()}`,
      status: 'success',
      amount: 2850,
    });
    const secret = process.env.PAYMENT_STUB_WEBHOOK_SECRET || 'stub-webhook-secret';
    const sig = createHmac('sha256', secret).update(payload).digest('hex');

    await request(app.getHttpServer())
      .post('/v1/payments/esewa/webhook')
      .send({ __raw: payload, __sig: sig })
      .expect(200);

    // Give the transaction a moment
    await new Promise((r) => setTimeout(r, 200));

    const status = await request(app.getHttpServer())
      .get(`/v1/payments/${paymentId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(status.body.status).toBe('confirmed');
    expect(status.body.invoiceStatus).toBe('paid');
  });

  it('rejects webhook with invalid signature', async () => {
    const { accessToken, invoiceId } = await seedCustomerWithInvoice();

    const initiate = await request(app.getHttpServer())
      .post('/v1/payments/esewa/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `test-bad-sig-${Date.now()}`)
      .send({ invoiceId })
      .expect(200);

    const payload = JSON.stringify({
      paymentId: initiate.body.paymentId,
      providerTxnId: 'FAKE',
      status: 'success',
      amount: 2850,
    });

    const res = await request(app.getHttpServer())
      .post('/v1/payments/esewa/webhook')
      .send({ __raw: payload, __sig: 'deadbeef' })
      .expect(401);

    expect(res.body.error?.message ?? res.body.message).toMatch(/signature/i);
  });

  it('deduplicates repeated webhooks with the same providerTxnId', async () => {
    const { accessToken, invoiceId } = await seedCustomerWithInvoice();

    const initiate = await request(app.getHttpServer())
      .post('/v1/payments/esewa/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `test-dedupe-${Date.now()}`)
      .send({ invoiceId })
      .expect(200);

    const txnId = `TEST-DUP-${Date.now()}`;
    const payload = JSON.stringify({
      paymentId: initiate.body.paymentId,
      providerTxnId: txnId,
      status: 'success',
      amount: 2850,
    });
    const secret = process.env.PAYMENT_STUB_WEBHOOK_SECRET || 'stub-webhook-secret';
    const sig = createHmac('sha256', secret).update(payload).digest('hex');

    // First delivery
    const first = await request(app.getHttpServer())
      .post('/v1/payments/esewa/webhook')
      .send({ __raw: payload, __sig: sig })
      .expect(200);

    // Second delivery
    const second = await request(app.getHttpServer())
      .post('/v1/payments/esewa/webhook')
      .send({ __raw: payload, __sig: sig })
      .expect(200);

    expect(second.body.duplicate).toBe(true);
  });
});
