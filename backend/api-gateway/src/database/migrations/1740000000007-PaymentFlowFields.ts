import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentFlowFields1740000000007 implements MigrationInterface {
  name = 'PaymentFlowFields1740000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Payments: idempotency is per-account-action, not global.
    // Webhook dedupe uses provider_txn_id (already unique).
    await queryRunner.query(`
      ALTER TABLE powerlink_core.payments
        ADD COLUMN IF NOT EXISTS redirect_url TEXT,
        ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES powerlink_core.customers(id),
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    `);

    // Invoices: link to the billing cycle it covers
    await queryRunner.query(`
      ALTER TABLE powerlink_core.invoices
        ADD COLUMN IF NOT EXISTS period_start DATE,
        ADD COLUMN IF NOT EXISTS period_end DATE
    `);

    // Idempotency keys: separate table so replays return the original response
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS powerlink_core.idempotency_keys (
        key VARCHAR(120) PRIMARY KEY,
        scope VARCHAR(80) NOT NULL,
        response_body JSONB NOT NULL,
        response_status INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_idem_expires ON powerlink_core.idempotency_keys(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS powerlink_core.idempotency_keys`);
    await queryRunner.query(`ALTER TABLE powerlink_core.invoices DROP COLUMN IF EXISTS period_start, DROP COLUMN IF EXISTS period_end`);
    await queryRunner.query(`ALTER TABLE powerlink_core.payments DROP COLUMN IF EXISTS redirect_url, DROP COLUMN IF EXISTS initiated_by, DROP COLUMN IF EXISTS expires_at`);
  }
}
