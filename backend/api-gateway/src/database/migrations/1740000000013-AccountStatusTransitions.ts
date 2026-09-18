import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountStatusTransitions1740000000013 implements MigrationInterface {
  name = 'AccountStatusTransitions1740000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE powerlink_core.account_status_transitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id) ON DELETE CASCADE,
        from_status powerlink_core.account_status,
        to_status powerlink_core.account_status NOT NULL,
        reason TEXT,
        actor_id UUID,
        actor_type VARCHAR(20) NOT NULL DEFAULT 'staff',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_account_transitions_account
        ON powerlink_core.account_status_transitions(account_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS powerlink_core.account_status_transitions`);
  }
}
