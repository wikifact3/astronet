import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpIpIndex1740000000005 implements MigrationInterface {
  name = 'AddOtpIpIndex1740000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_otp_codes_ip_address ON powerlink_core.otp_codes(ip_address)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_otp_codes_created_at ON powerlink_core.otp_codes(created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.idx_otp_codes_ip_address`);
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.idx_otp_codes_created_at`);
  }
}
