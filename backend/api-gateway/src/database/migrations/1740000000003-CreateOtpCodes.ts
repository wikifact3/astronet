import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpCodes1740000000003 implements MigrationInterface {
  name = 'CreateOtpCodes1740000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE powerlink_core.otp_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        attempt_count INT NOT NULL DEFAULT 0,
        ip_address INET,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_otp_codes_phone ON powerlink_core.otp_codes(phone)`);
    await queryRunner.query(`CREATE INDEX idx_otp_codes_expires_at ON powerlink_core.otp_codes(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE powerlink_core.otp_codes`);
  }
}
