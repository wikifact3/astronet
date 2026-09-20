import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsLogs1740000000016 implements MigrationInterface {
  name = 'SmsLogs1740000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE powerlink_core.sms_status AS ENUM ('pending','sent','failed','fallback')
    `);
    await queryRunner.query(`
      CREATE TYPE powerlink_core.sms_category AS ENUM ('otp','payment','ticket','kyc','lead','broadcast','other')
    `);
    await queryRunner.query(`
      CREATE TABLE powerlink_core.sms_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        category powerlink_core.sms_category NOT NULL,
        message TEXT NOT NULL,
        status powerlink_core.sms_status NOT NULL DEFAULT 'pending',
        provider_message_id VARCHAR(100),
        error TEXT,
        provider VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_sms_logs_phone ON powerlink_core.sms_logs(phone)`);
    await queryRunner.query(`CREATE INDEX idx_sms_logs_category_time ON powerlink_core.sms_logs(category, created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS powerlink_core.sms_logs`);
    await queryRunner.query(`DROP TYPE IF EXISTS powerlink_core.sms_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS powerlink_core.sms_category`);
  }
}
