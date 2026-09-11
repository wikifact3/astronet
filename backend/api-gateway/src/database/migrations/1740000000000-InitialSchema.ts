import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1740000000000 implements MigrationInterface {
  name = 'InitialSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS powerlink_core`);

    // ---------- ENUMS ----------
    await queryRunner.query(`CREATE TYPE powerlink_core.account_status AS ENUM ('lead','kyc_pending','kyc_rejected','installation_scheduled','active','suspended','churned')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.account_type AS ENUM ('retail','enterprise')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.fup_tier AS ENUM ('normal','throttle_l1','throttle_l2')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.kyc_status AS ENUM ('pending','approved','rejected')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.invoice_status AS ENUM ('draft','issued','paid','overdue','cancelled','credit_note')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.ird_sync_status AS ENUM ('pending','synced','failed','not_applicable')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.payment_status AS ENUM ('initiated','pending_confirmation','confirmed','declined','timeout','refunded','failed')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.payment_provider AS ENUM ('esewa','khalti','fonepay','connectips')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.ticket_status AS ENUM ('open','assigned','field_tech_dispatched','pending_customer','resolved','reopened','closed')`);
    await queryRunner.query(`CREATE TYPE powerlink_core.ticket_category AS ENUM ('connectivity','billing','hardware','installation','general')`);

    // ---------- ROLES ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- PERMISSIONS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(resource, action)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE powerlink_core.role_permissions (
        role_id UUID NOT NULL REFERENCES powerlink_core.roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES powerlink_core.permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    // ---------- STAFF USERS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.staff_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role_id UUID NOT NULL REFERENCES powerlink_core.roles(id),
        ward_access TEXT[],
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- CUSTOMERS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        preferred_language VARCHAR(10) DEFAULT 'en',
        kyc_status powerlink_core.kyc_status DEFAULT 'pending',
        notification_preferences JSONB DEFAULT '{"sms":true,"email":true,"in_app":true}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- ACCOUNTS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES powerlink_core.customers(id),
        parent_account_id UUID REFERENCES powerlink_core.accounts(id),
        account_type powerlink_core.account_type NOT NULL DEFAULT 'retail',
        status powerlink_core.account_status NOT NULL DEFAULT 'lead',
        billing_address JSONB,
        installation_address JSONB,
        gps_coordinates JSONB,
        referral_code VARCHAR(20) UNIQUE,
        referred_by UUID REFERENCES powerlink_core.accounts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_parent CHECK (parent_account_id IS NULL OR parent_account_id <> id)
      )
    `);

    // ---------- PLANS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        speed_mbps INTEGER NOT NULL,
        base_price DECIMAL(12,2) NOT NULL,
        vat_rate DECIMAL(5,2) NOT NULL DEFAULT 13.00,
        tsc_rate DECIMAL(5,2) NOT NULL DEFAULT 1.00,
        fup_threshold_gb INTEGER,
        bundle_addons JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- SUBSCRIPTIONS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id),
        plan_id UUID NOT NULL REFERENCES powerlink_core.plans(id),
        status VARCHAR(20) NOT NULL DEFAULT 'pending_activation',
        validity_start DATE NOT NULL,
        validity_end DATE NOT NULL,
        fup_tier powerlink_core.fup_tier NOT NULL DEFAULT 'normal',
        auto_renew BOOLEAN DEFAULT true,
        grace_period_used_this_year INTEGER DEFAULT 0,
        max_grace_period_per_year INTEGER DEFAULT 2,
        billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- INVOICES ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id),
        subscription_id UUID NOT NULL REFERENCES powerlink_core.subscriptions(id),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        vat_amount DECIMAL(12,2) NOT NULL,
        tsc_amount DECIMAL(12,2) NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        status powerlink_core.invoice_status NOT NULL DEFAULT 'draft',
        ird_sync_status powerlink_core.ird_sync_status DEFAULT 'not_applicable',
        ird_sync_attempted_at TIMESTAMPTZ,
        ird_sync_error TEXT,
        pdf_url VARCHAR(500),
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        due_date DATE NOT NULL,
        paid_at TIMESTAMPTZ,
        notes TEXT,
        original_invoice_id UUID REFERENCES powerlink_core.invoices(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- PAYMENTS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES powerlink_core.invoices(id),
        provider powerlink_core.payment_provider NOT NULL,
        provider_txn_id VARCHAR(100) UNIQUE,
        amount DECIMAL(12,2) NOT NULL,
        status powerlink_core.payment_status NOT NULL DEFAULT 'initiated',
        idempotency_key VARCHAR(100) UNIQUE NOT NULL,
        webhook_payload JSONB,
        webhook_received_at TIMESTAMPTZ,
        initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        error_code VARCHAR(50),
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- DEVICES ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id),
        onu_serial VARCHAR(50) UNIQUE NOT NULL,
        olt_id VARCHAR(50) NOT NULL,
        olt_port VARCHAR(20) NOT NULL,
        radius_profile_id VARCHAR(50),
        device_model VARCHAR(100),
        firmware_version VARCHAR(50),
        last_seen_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- KYC DOCUMENTS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.kyc_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id),
        document_type VARCHAR(50) NOT NULL,
        encrypted_file_ref VARCHAR(500) NOT NULL,
        encrypted_national_id VARCHAR(500),
        status powerlink_core.kyc_status NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES powerlink_core.staff_users(id),
        review_reason_code VARCHAR(50),
        review_notes TEXT,
        reviewed_at TIMESTAMPTZ,
        expires_at DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- TICKETS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id),
        category powerlink_core.ticket_category NOT NULL,
        status powerlink_core.ticket_status NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        assigned_to UUID REFERENCES powerlink_core.staff_users(id),
        assigned_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        reopened_count INTEGER DEFAULT 0,
        reopen_deadline TIMESTAMPTZ,
        customer_satisfaction_rating INTEGER,
        ward VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE powerlink_core.ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES powerlink_core.tickets(id),
        author_id UUID NOT NULL,
        author_type VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT false,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- COVERAGE GEO ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.coverage_geo_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        province VARCHAR(100) NOT NULL,
        district VARCHAR(100) NOT NULL,
        municipality VARCHAR(100) NOT NULL,
        ward VARCHAR(20) NOT NULL,
        coverage_status VARCHAR(50) NOT NULL,
        estimated_availability_quarter VARCHAR(20),
        gps_bounds JSONB,
        details JSONB,
        last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(province, district, municipality, ward)
      )
    `);

    // ---------- NOTIFICATIONS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id UUID NOT NULL,
        recipient_type VARCHAR(20) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        template_id VARCHAR(50) NOT NULL,
        content JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- AUDIT LOGS ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID NOT NULL,
        actor_type VARCHAR(20) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID NOT NULL,
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------- INDEXES ----------
    await queryRunner.query(`CREATE INDEX idx_customers_phone ON powerlink_core.customers(phone)`);
    await queryRunner.query(`CREATE INDEX idx_accounts_customer ON powerlink_core.accounts(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_accounts_status ON powerlink_core.accounts(status)`);
    await queryRunner.query(`CREATE INDEX idx_subscriptions_account ON powerlink_core.subscriptions(account_id)`);
    await queryRunner.query(`CREATE INDEX idx_invoices_account ON powerlink_core.invoices(account_id)`);
    await queryRunner.query(`CREATE INDEX idx_payments_invoice ON powerlink_core.payments(invoice_id)`);
    await queryRunner.query(`CREATE INDEX idx_tickets_account ON powerlink_core.tickets(account_id)`);
    await queryRunner.query(`CREATE INDEX idx_coverage_lookup ON powerlink_core.coverage_geo_data(province,district,municipality,ward)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_timestamp ON powerlink_core.audit_logs(timestamp)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS powerlink_core CASCADE`);
  }
}
