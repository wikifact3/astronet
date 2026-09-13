import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokens1740000000004 implements MigrationInterface {
  name = 'CreateRefreshTokens1740000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE powerlink_core.refresh_tokens (
        jti UUID PRIMARY KEY,
        family_id UUID NOT NULL,
        customer_id UUID NOT NULL REFERENCES powerlink_core.customers(id) ON DELETE CASCADE,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        ip_address INET,
        user_agent TEXT
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_customer ON powerlink_core.refresh_tokens(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family ON powerlink_core.refresh_tokens(family_id)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_expires ON powerlink_core.refresh_tokens(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE powerlink_core.refresh_tokens`);
  }
}
