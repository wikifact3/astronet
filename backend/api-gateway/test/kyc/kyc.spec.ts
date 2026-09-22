import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Buffer } from 'buffer';
import {
  createTestApp, adminLogin, seedActiveCustomer, cleanupTestPhone,
} from '../helpers/test-app';

// Minimal valid PNG (1x1 transparent)
function tinyPng(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // We use a pre-built 67-byte PNG (CRLF preserved) — same one used in dev
  // tests. Generating IHDR/IDAT by hand risks subtle chunk errors.
  return Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
      '01f15c4890000000d49444154789c6360000002000100' +
      '05fe02fea7c1c3b10000000049454e44ae426082',
    'hex',
  );
}

describe('KYC (e2e)', () => {
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

  it('uploads a PNG, scans it, and marks it verified', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const session = await request(app.getHttpServer())
      .post('/v1/kyc/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'citizenship_front' })
      .expect(201);

    const upload = await request(app.getHttpServer())
      .post(`/v1/kyc/upload/${session.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', tinyPng(), 'test.png')
      .expect(201);

    expect(upload.body.pipelineStatus).toBe('uploaded');
    expect(upload.body.mimeType).toBe('image/png');
    expect(upload.body.fileSizeBytes).toBeGreaterThan(0);

    // Wait for the scan worker (stub has 5s delay)
    const docId = upload.body.id;
    let final = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const rows = await db.query(
        `SELECT pipeline_status FROM powerlink_core.kyc_documents WHERE id = $1`,
        [docId],
      );
      final = rows[0]?.pipeline_status;
      if (final === 'verified' || final === 'failed') break;
    }
    expect(final).toBe('verified');
  }, 30_000);

  it('rejects an oversized file', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const session = await request(app.getHttpServer())
      .post('/v1/kyc/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'citizenship_back' })
      .expect(201);

    // 6 MB buffer that passes PNG magic but is over the limit
    const big = Buffer.concat([tinyPng(), Buffer.alloc(6 * 1024 * 1024)]);

    await request(app.getHttpServer())
      .post(`/v1/kyc/upload/${session.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', big, 'big.png')
      .expect(413);
  }, 30_000);

  it('admin approves a verified document and customer kyc_status flips', async () => {
    const { phone, customerId, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const session = await request(app.getHttpServer())
      .post('/v1/kyc/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'citizenship_front' });

    const upload = await request(app.getHttpServer())
      .post(`/v1/kyc/upload/${session.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', tinyPng(), 'test.png');

    // Wait for verified
    const docId = upload.body.id;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const rows = await db.query(
        `SELECT pipeline_status FROM powerlink_core.kyc_documents WHERE id = $1`,
        [docId],
      );
      if (rows[0]?.pipeline_status === 'verified') break;
    }

    const adminToken = await adminLogin(app);
    const review = await request(app.getHttpServer())
      .post(`/v1/admin/kyc/${docId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve', reasonCode: 'document_clear' })
      .expect(201);

    expect(review.body.status).toBe('approved');

    const custRows = await db.query(
      `SELECT kyc_status FROM powerlink_core.customers WHERE id = $1`,
      [customerId],
    );
    expect(custRows[0].kyc_status).toBe('approved');
  }, 30_000);

  it('admin rejects a verified document with a reason', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const session = await request(app.getHttpServer())
      .post('/v1/kyc/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'citizenship_back' });

    const upload = await request(app.getHttpServer())
      .post(`/v1/kyc/upload/${session.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', tinyPng(), 'test.png');

    const docId = upload.body.id;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const rows = await db.query(
        `SELECT pipeline_status FROM powerlink_core.kyc_documents WHERE id = $1`,
        [docId],
      );
      if (rows[0]?.pipeline_status === 'verified') break;
    }

    const adminToken = await adminLogin(app);
    const review = await request(app.getHttpServer())
      .post(`/v1/admin/kyc/${docId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'reject',
        reasonCode: 'document_illegible',
        notes: 'Image is too dark to read.',
      })
      .expect(201);

    expect(review.body.status).toBe('rejected');
    expect(review.body.reviewReasonCode).toBe('document_illegible');
  }, 30_000);
});
