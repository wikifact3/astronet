import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpRequestLog1740000000006 implements MigrationInterface {
  name = 'CreateOtpRequestLog1740000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE powerlink_core.otp_request_outcome AS ENUM
        ('sent', 'not_registered', 'rate_limited', 'send_failed')
    `);

    await queryRunner.query(`
      CREATE TABLE powerlink_core.otp_request_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        ip_address INET,
        outcome powerlink_core.otp_request_outcome NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_otp_request_log_phone_time ON powerlink_core.otp_request_log(phone, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_otp_request_log_ip_time ON powerlink_core.otp_request_log(ip_address, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_otp_request_log_time ON powerlink_core.otp_request_log(created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE powerlink_core.otp_request_log`);
    await queryRunner.query(`DROP TYPE powerlink_core.otp_request_outcome`);
  }
}
