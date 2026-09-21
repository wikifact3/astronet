import { MigrationInterface, QueryRunner } from 'typeorm';

export class CancellationRequests1740000000017 implements MigrationInterface {
  name = 'CancellationRequests1740000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE powerlink_core.cancellation_request_status AS ENUM
        ('pending','approved','rejected','withdrawn')
    `);

    await queryRunner.query(`
      CREATE TABLE powerlink_core.cancellation_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES powerlink_core.subscriptions(id),
        reason TEXT NOT NULL,
        status powerlink_core.cancellation_request_status NOT NULL DEFAULT 'pending',
        reviewed_by UUID,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_cancellation_requests_account ON powerlink_core.cancellation_requests(account_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_cancellation_requests_status ON powerlink_core.cancellation_requests(status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS powerlink_core.cancellation_requests`);
    await queryRunner.query(`DROP TYPE IF EXISTS powerlink_core.cancellation_request_status`);
  }
}
