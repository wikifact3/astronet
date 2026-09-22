import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  createTestApp, adminLogin, seedActiveCustomer, cleanupTestPhone,
} from '../helpers/test-app';

describe('Tickets (e2e)', () => {
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

  it('customer creates a ticket with inherited ward', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db, { ward: '9' });
    phonesUsed.push(phone);

    const res = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'connectivity',
        subject: 'Slow speed evenings',
        description: 'Connection drops between 7-10pm every day this week.',
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe('open');
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].authorType).toBe('customer');

    // Ward inherited from the account
    const rows = await db.query(
      `SELECT ward FROM powerlink_core.tickets WHERE id = $1`,
      [res.body.id],
    );
    expect(rows[0].ward).toBe('9');
  });

  it('customer replies and admin sees the message', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const create = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'billing',
        subject: 'Incorrect charge',
        description: 'I was billed twice for the same period.',
      });

    const ticketId = create.body.id;

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Screenshot attached in my email.' })
      .expect(201);

    // Admin views it
    const adminToken = await adminLogin(app);
    const admin = await request(app.getHttpServer())
      .get(`/v1/admin/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(admin.body.messages.length).toBe(2);
    expect(admin.body.messages[1].message).toBe('Screenshot attached in my email.');
  });

  it('admin can assign to a NOC dispatcher', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const create = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'hardware',
        subject: 'ONU LED is red',
        description: 'The ONU shows a red light since this morning.',
      });

    const adminToken = await adminLogin(app);

    // Find the NOC user
    const staff = await request(app.getHttpServer())
      .get('/v1/admin/tickets/assignable-staff')
      .set('Authorization', `Bearer ${adminToken}`);

    const noc = staff.body.staff.find(
      (s: { role: string }) => s.role === 'NOC_DISPATCHER',
    );
    if (!noc) {
      // Ensure the NOC user exists for this test
      const roleRows = await db.query(
        `SELECT id FROM powerlink_core.roles WHERE name = 'NOC_DISPATCHER'`,
      );
      await db.query(
        `INSERT INTO powerlink_core.staff_users (email, full_name, role_id, is_active)
         VALUES ($1, 'Test NOC', $2, true)
         ON CONFLICT (email) DO NOTHING`,
        [`noc-test-${Date.now()}@powerlink.test`, roleRows[0].id],
      );
      const again = await request(app.getHttpServer())
        .get('/v1/admin/tickets/assignable-staff')
        .set('Authorization', `Bearer ${adminToken}`);
      const nocId = again.body.staff.find(
        (s: { role: string }) => s.role === 'NOC_DISPATCHER',
      )?.id;
      expect(nocId).toBeTruthy();

      const assign = await request(app.getHttpServer())
        .post(`/v1/admin/tickets/${create.body.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ staffId: nocId })
        .expect(201);
      expect(assign.body.status).toBe('assigned');
      return;
    }

    const assign = await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${create.body.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId: noc.id })
      .expect(201);

    expect(assign.body.assignedToId).toBe(noc.id);
    expect(assign.body.status).toBe('assigned');
  });

  it('admin resolves a ticket and sets a 7-day reopen deadline', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const create = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'general',
        subject: 'Question about billing cycle',
        description: 'When exactly does my next cycle start?',
      });

    const adminToken = await adminLogin(app);

    const resolved = await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${create.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', note: 'Answered by phone.' })
      .expect(201);

    expect(resolved.body.status).toBe('resolved');
    expect(resolved.body.resolvedAt).toBeTruthy();

    const rows = await db.query(
      `SELECT reopen_deadline FROM powerlink_core.tickets WHERE id = $1`,
      [create.body.id],
    );
    const deadline = new Date(rows[0].reopen_deadline);
    const diffDays = Math.round(
      (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it('customer can reopen a resolved ticket within the window', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const create = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'connectivity',
        subject: 'Intermittent drops',
        description: 'Loses connection for a few seconds every hour.',
      });

    const adminToken = await adminLogin(app);
    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${create.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' })
      .expect(201);

    const reopened = await request(app.getHttpServer())
      .post(`/v1/tickets/${create.body.id}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(reopened.body.status).toBe('reopened');
    expect(reopened.body.reopenedCount).toBe(1);
  });

  it('rejects reopen on a non-resolved ticket', async () => {
    const { phone, accessToken } = await seedActiveCustomer(app, db);
    phonesUsed.push(phone);

    const create = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'general',
        subject: 'Test ticket',
        description: 'Just a test for reopen validation.',
      });

    await request(app.getHttpServer())
      .post(`/v1/tickets/${create.body.id}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });
});
