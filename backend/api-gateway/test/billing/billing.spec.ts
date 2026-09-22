import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  createTestApp, adminLogin, seedActiveCustomer, cleanupTestPhone,
} from '../helpers/test-app';

describe('Billing (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const phonesUsed: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    for (const p of phonesUsed) await cleanupTestPhone(db, p);
    await app.close();
  });

  it('returns a reconciliation summary', async () => {
    const adminToken = await adminLogin(app);

    const res = await request(app.getHttpServer())
      .get('/v1/admin/billing/invoices?limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.amounts).toHaveProperty('outstanding');
    expect(res.body.summary.amounts).toHaveProperty('collected');
    expect(res.body.summary.counts).toHaveProperty('issued');
  });

  it('records a manual charge as a new linked invoice', async () => {
    const { phone, accountId } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const adminToken = await adminLogin(app);

    const res = await request(app.getHttpServer())
      .post('/v1/admin/billing/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountId,
        kind: 'charge',
        amount: 250,
        reason: 'Late payment fee for September',
      })
      .expect(201);

    expect(res.body.invoiceNumber).toMatch(/^ADJ-/);
    expect(res.body.kind).toBe('charge');
    expect(res.body.amount).toBe(250);

    // Verify audit row
    const audit = await db.query(
      `SELECT action FROM powerlink_core.audit_logs
       WHERE resource_id = $1 AND action = 'billing.charge'`,
      [res.body.invoiceId],
    );
    expect(audit.length).toBe(1);
  });

  it('records a credit note for a charge', async () => {
    const { phone, accountId } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const adminToken = await adminLogin(app);

    const res = await request(app.getHttpServer())
      .post('/v1/admin/billing/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountId,
        kind: 'credit',
        amount: 500,
        reason: 'Outage credit for 3 days',
      })
      .expect(201);

    expect(res.body.invoiceNumber).toMatch(/^ADJ-/);
    expect(res.body.kind).toBe('credit');

    const inv = await db.query(
      `SELECT total_amount, status FROM powerlink_core.invoices WHERE id = $1`,
      [res.body.invoiceId],
    );
    expect(Number(inv[0].total_amount)).toBe(-500);
    expect(inv[0].status).toBe('credit_note');
  });

  it('rejects refund without an original paid invoice', async () => {
    const { phone, accountId } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const adminToken = await adminLogin(app);

    // Refund with no originalInvoiceId
    await request(app.getHttpServer())
      .post('/v1/admin/billing/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountId,
        kind: 'refund',
        amount: 100,
        reason: 'Test refund without original',
      })
      .expect(400);
  });

  it('SUPPORT_AGENT cannot adjust (role gate)', async () => {
    const { phone, accountId } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    // Create a support-agent staff user
    const roleRows = await db.query(
      `SELECT id FROM powerlink_core.roles WHERE name = 'SUPPORT_AGENT'`,
    );
    const email = `support-${Date.now()}@powerlink.test`;
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('TestPassword123!', 10);

    await db.query(
      `INSERT INTO powerlink_core.staff_users (email, full_name, role_id, is_active, password_hash)
       VALUES ($1, 'Support Agent', $2, true, $3)`,
      [email, roleRows[0].id, hash],
    );

    const login = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: 'TestPassword123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/billing/adjustments')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        accountId,
        kind: 'charge',
        amount: 100,
        reason: 'Should be blocked',
      })
      .expect(403);

    // Cleanup the staff user
    await db.query(`DELETE FROM powerlink_core.staff_users WHERE email = $1`, [email]);
  });
});
