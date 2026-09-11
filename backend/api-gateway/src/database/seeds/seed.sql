-- Seed Roles
INSERT INTO powerlink_core.roles (id, name, description) VALUES
    (gen_random_uuid(), 'CUSTOMER', 'Self-service portal access, scoped to own account'),
    (gen_random_uuid(), 'SUPPORT_AGENT', 'View customer account/billing/device/ticket info; cannot view KYC'),
    (gen_random_uuid(), 'KYC_REVIEWER', 'Review/approve/reject KYC documents'),
    (gen_random_uuid(), 'NOC_DISPATCHER', 'View/assign tickets, view device/OLT status'),
    (gen_random_uuid(), 'FIELD_TECHNICIAN', 'View assigned tickets and relevant account/device info'),
    (gen_random_uuid(), 'BILLING_ADMIN', 'Full billing/invoice access, refund issuance, IRD sync monitoring'),
    (gen_random_uuid(), 'SUPER_ADMIN', 'Full system access, including role management and audit logs')
ON CONFLICT (name) DO NOTHING;

-- Seed Permissions
INSERT INTO powerlink_core.permissions (resource, action) VALUES
    ('account', 'read_own'),
    ('account', 'read_any'),
    ('account', 'update_own'),
    ('account', 'update_any'),
    ('kyc', 'view_own'),
    ('kyc', 'view_any'),
    ('kyc', 'review'),
    ('billing', 'read_own'),
    ('billing', 'read_any'),
    ('billing', 'write'),
    ('billing', 'issue_refund'),
    ('tickets', 'create_own'),
    ('tickets', 'read_own'),
    ('tickets', 'read_any'),
    ('tickets', 'assign'),
    ('tickets', 'update_status'),
    ('devices', 'read_own'),
    ('devices', 'read_any'),
    ('audit', 'read'),
    ('users', 'manage'),
    ('roles', 'manage')
ON CONFLICT (resource, action) DO NOTHING;

-- Seed Sample Plans
INSERT INTO powerlink_core.plans (id, name, speed_mbps, base_price, vat_rate, tsc_rate, fup_threshold_gb, bundle_addons, display_order) VALUES
    (gen_random_uuid(), 'Fiber Basic', 50, 1500.00, 13.00, 1.00, 100, '[]', 1),
    (gen_random_uuid(), 'Fiber Standard', 100, 2500.00, 13.00, 1.00, 200, '[]', 2),
    (gen_random_uuid(), 'Fiber Premium', 200, 4500.00, 13.00, 1.00, 500, '[]', 3),
    (gen_random_uuid(), 'Fiber Ultimate', 500, 8000.00, 13.00, 1.00, 1000, '[]', 4)
ON CONFLICT (name) DO NOTHING;

-- Seed Sample Coverage Data
INSERT INTO powerlink_core.coverage_geo_data (id, province, district, municipality, ward, coverage_status, estimated_availability_quarter) VALUES
    (gen_random_uuid(), 'Bagmati', 'Kathmandu', 'Kathmandu', '1', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Kathmandu', 'Kathmandu', '2', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Kathmandu', 'Kathmandu', '3', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Kathmandu', 'Kathmandu', '4', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Kathmandu', 'Kathmandu', '5', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Lalitpur', 'Lalitpur', '1', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Lalitpur', 'Lalitpur', '2', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Lalitpur', 'Lalitpur', '3', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Lalitpur', 'Lalitpur', '4', 'available', NULL),
    (gen_random_uuid(), 'Bagmati', 'Bhaktapur', 'Bhaktapur', '1', 'coming_soon', 'Q1 2025'),
    (gen_random_uuid(), 'Bagmati', 'Bhaktapur', 'Bhaktapur', '2', 'coming_soon', 'Q1 2025'),
    (gen_random_uuid(), 'Gandaki', 'Pokhara', 'Pokhara', '1', 'available', NULL),
    (gen_random_uuid(), 'Gandaki', 'Pokhara', 'Pokhara', '2', 'available', NULL)
ON CONFLICT (province, district, municipality, ward) DO NOTHING;

-- Create admin user if not exists
INSERT INTO powerlink_core.customers (id, phone, email, full_name, preferred_language, kyc_status) 
SELECT gen_random_uuid(), '9800000000', 'admin@powerlink.com.np', 'Admin User', 'en', 'approved'
WHERE NOT EXISTS (SELECT 1 FROM powerlink_core.customers WHERE phone = '9800000000');

-- Create super admin staff user
INSERT INTO powerlink_core.staff_users (id, email, full_name, phone, role_id, is_active)
SELECT 
    gen_random_uuid(),
    'admin@powerlink.com.np',
    'Super Admin',
    '9800000000',
    (SELECT id FROM powerlink_core.roles WHERE name = 'SUPER_ADMIN'),
    true
WHERE NOT EXISTS (SELECT 1 FROM powerlink_core.staff_users WHERE email = 'admin@powerlink.com.np');
