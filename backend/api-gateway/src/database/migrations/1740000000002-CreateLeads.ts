import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeads1740000000002 implements MigrationInterface {
  name = 'CreateLeads1740000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE powerlink_core.lead_status AS ENUM
        ('draft','submitted','contacted','converted','rejected','expired')
    `);

    await queryRunner.query(`
      CREATE TABLE powerlink_core.leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        draft_token VARCHAR(64) UNIQUE NOT NULL,
        status powerlink_core.lead_status NOT NULL DEFAULT 'draft',
        full_name VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        province VARCHAR(100),
        district VARCHAR(100),
        municipality VARCHAR(100),
        ward VARCHAR(20),
        street VARCHAR(255),
        gps_lat NUMERIC(10,7),
        gps_lng NUMERIC(10,7),
        preferred_plan_id UUID,
        notes TEXT,
        reference_id VARCHAR(20) UNIQUE,
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_leads_phone ON powerlink_core.leads(phone)`);
    await queryRunner.query(`CREATE INDEX idx_leads_status ON powerlink_core.leads(status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE powerlink_core.leads`);
    await queryRunner.query(`DROP TYPE powerlink_core.lead_status`);
  }
}
