import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraints1740000000001 implements MigrationInterface {
  name = 'AddUniqueConstraints1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // plans.name must be unique for ON CONFLICT (name) to work in seeds
    await queryRunner.query(`
      ALTER TABLE powerlink_core.plans
      ADD CONSTRAINT uq_plans_name UNIQUE (name)
    `);

    // customers.email already unique in DDL, but confirm as named constraint
    // (skip if it's already there — wrapped in DO block for idempotency)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_customers_email'
            AND conrelid = 'powerlink_core.customers'::regclass
        ) THEN
          ALTER TABLE powerlink_core.customers
          ADD CONSTRAINT uq_customers_email UNIQUE (email);
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE powerlink_core.plans DROP CONSTRAINT IF EXISTS uq_plans_name`);
    await queryRunner.query(`ALTER TABLE powerlink_core.customers DROP CONSTRAINT IF EXISTS uq_customers_email`);
  }
}
