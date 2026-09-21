import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createTestApp, randomPhone, cleanupTestPhone } from '../helpers/test-app';

describe('Auth (e2e)', () => {
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

  it('rejects OTP request for unknown number with not_registered', async () => {
    const phone = randomPhone();
    phonesUsed.push(phone);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(200);

    expect(res.body.status).toBe('not_registered');
    expect(res.body.applyUrl).toContain(phone);
  });

  it('accepts OTP for known customer and issues tokens on verify', async () => {
    // Seed a customer directly
    const phone = randomPhone();
    await db.query(
      `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
       VALUES ($1, 'Test User', 'approved')`,
      [phone],
    );

    const send = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(200);
    expect(send.body.status).toBe('sent');

    // Read the OTP from the DB (dev provider doesn't expose it via API)
    const rows = await db.query(
      `SELECT code FROM powerlink_core.otp_codes
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    expect(rows.length).toBe(1);
    const otp = rows[0].code;

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone, otp })
      .expect(200);

    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.user.phone).toBe(phone);
    expect(verify.headers['set-cookie']).toBeDefined();

    // Clean up
  });

  it('rejects invalid OTP', async () => {
    const phone = randomPhone();
    await db.query(
      `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
       VALUES ($1, 'Test User', 'approved')`,
      [phone],
    );

    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone, otp: '000000' })
      .expect(401);
  });

  it('rate limits OTP requests per phone', async () => {
    const phone = randomPhone();
    await db.query(
      `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
       VALUES ($1, 'Test User', 'approved')`,
      [phone],
    );

    // Clear any prior rate-limit rows

    // Fire 5 successful requests
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/v1/auth/otp/request')
        .send({ phone })
        .expect(200);
    }

    // 6th should 429
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(429);

    expect(res.body.error?.code ?? res.body.code).toBe('OTP_PHONE_LIMIT');
  });

  it('detects refresh token reuse and revokes the family', async () => {
    const phone = randomPhone();
    await db.query(
      `INSERT INTO powerlink_core.customers (phone, full_name, kyc_status)
       VALUES ($1, 'Test User', 'approved')`,
      [phone],
    );

    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone });

    const rows = await db.query(
      `SELECT code FROM powerlink_core.otp_codes
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    const otp = rows[0].code;

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone, otp });

    const rawCookies = verify.headers['set-cookie'] as unknown;
    const cookies: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [String(rawCookies)]
        : [];
    expect(cookies.length).toBeGreaterThan(0);
    const maybeCookie = cookies.find((c) => c.startsWith('powerlink_refresh='));
    expect(maybeCookie).toBeDefined();
    if (!maybeCookie) throw new Error('refresh cookie missing');
    const refreshCookie: string = maybeCookie;

    // First refresh — succeeds and rotates
    const first = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(first.body.accessToken).toBeTruthy();

    // Replay the original cookie — should trigger reuse detection
    const replay = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);
    expect(replay.body.error?.message ?? replay.body.message).toMatch(/reuse/i);
  });
});
