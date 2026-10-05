-- ============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Core schema for Multi-Tenant Digital Loyalty Platform
-- Tables:
--   1. restaurants
--   2. restaurant_settings
--   3. restaurant_staff
--   4. customers
--   5. customer_restaurant_memberships
--   6. loyalty_accounts
--   7. loyalty_transactions (Auditable Ledger)
--   8. loyalty_rules
--   9. rewards
--   10. reward_redemptions
--   11. visits
--   12. qr_codes
--   13. audit_logs
-- ============================================================================

-- Extensions (safely loaded if available in target PostgreSQL environment)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Mock/ensure 'auth' schema exists for local test environments (handled safely on hosted Supabase)
DO $$
BEGIN
    CREATE SCHEMA IF NOT EXISTS auth;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $func$
    BEGIN
        RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    $func$ LANGUAGE plpgsql STABLE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. RESTAURANTS (Tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    tagline VARCHAR(256),
    logo_url TEXT,
    brand_color VARCHAR(16) DEFAULT '#10B981' NOT NULL,
    accent_color VARCHAR(16) DEFAULT '#059669' NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_restaurant_slug_format CHECK (slug ~* '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);

-- ----------------------------------------------------------------------------
-- 2. RESTAURANT SETTINGS & LOYALTY RULES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_settings (
    restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    loyalty_model VARCHAR(16) DEFAULT 'POINTS' NOT NULL,
    points_per_currency_unit NUMERIC(10, 2) DEFAULT 1.00 NOT NULL,
    stamps_target_count INT DEFAULT 10 NOT NULL,
    stamp_minimum_spend NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    reward_expiry_days INT DEFAULT 30 NOT NULL,
    redemption_code_ttl_minutes INT DEFAULT 15 NOT NULL,
    welcome_bonus_points INT DEFAULT 0 NOT NULL,
    welcome_bonus_stamps INT DEFAULT 0 NOT NULL,
    terms_and_conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_settings_loyalty_model CHECK (loyalty_model IN ('POINTS', 'STAMPS')),
    CONSTRAINT chk_settings_points_rate CHECK (points_per_currency_unit >= 0),
    CONSTRAINT chk_settings_stamps_target CHECK (stamps_target_count > 0),
    CONSTRAINT chk_settings_stamp_min_spend CHECK (stamp_minimum_spend >= 0),
    CONSTRAINT chk_settings_reward_expiry CHECK (reward_expiry_days > 0),
    CONSTRAINT chk_settings_code_ttl CHECK (redemption_code_ttl_minutes > 0),
    CONSTRAINT chk_settings_welcome_points CHECK (welcome_bonus_points >= 0),
    CONSTRAINT chk_settings_welcome_stamps CHECK (welcome_bonus_stamps >= 0)
);

-- ----------------------------------------------------------------------------
-- 3. RESTAURANT STAFF (Multi-tenant RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id)
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'STAFF',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_staff_role CHECK (role IN ('STAFF', 'MANAGER', 'OWNER')),
    CONSTRAINT uq_staff_restaurant_user UNIQUE (restaurant_id, user_id),
    CONSTRAINT uq_staff_restaurant_email UNIQUE (restaurant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_user ON restaurant_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON restaurant_staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON restaurant_staff(restaurant_id, role) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 4. CUSTOMERS (Global Identity normalized by Phone)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- references auth.users(id) when authenticated
    phone VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(128),
    birthday DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_customer_phone_format CHECK (phone ~* '^\+?[0-9]{7,15}$')
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

-- ----------------------------------------------------------------------------
-- 5. CUSTOMER RESTAURANT MEMBERSHIPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_restaurant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    membership_number VARCHAR(32) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT uq_membership_tenant_customer UNIQUE (restaurant_id, customer_id),
    CONSTRAINT uq_membership_tenant_number UNIQUE (restaurant_id, membership_number)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_customer ON customer_restaurant_memberships(restaurant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_customer ON customer_restaurant_memberships(customer_id);

-- ----------------------------------------------------------------------------
-- 6. LOYALTY ACCOUNTS (Auditable Balance Tracker)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    loyalty_model VARCHAR(16) NOT NULL,
    current_balance INT DEFAULT 0 NOT NULL,
    lifetime_accrued INT DEFAULT 0 NOT NULL,
    lifetime_redeemed INT DEFAULT 0 NOT NULL,
    version INT DEFAULT 1 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_account_model CHECK (loyalty_model IN ('POINTS', 'STAMPS')),
    CONSTRAINT chk_account_positive_balance CHECK (current_balance >= 0),
    CONSTRAINT chk_account_lifetime_accrued CHECK (lifetime_accrued >= 0),
    CONSTRAINT chk_account_lifetime_redeemed CHECK (lifetime_redeemed >= 0),
    CONSTRAINT chk_account_version CHECK (version >= 1),
    CONSTRAINT uq_loyalty_account_tenant_customer UNIQUE (restaurant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_lookup ON loyalty_accounts(restaurant_id, customer_id);

-- ----------------------------------------------------------------------------
-- 7. LOYALTY TRANSACTIONS (Append-Only Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    points_stamps INT NOT NULL, -- positive credit, negative debit
    balance_after INT NOT NULL,
    reference_id VARCHAR(128),
    idempotency_key VARCHAR(128),
    description VARCHAR(255) NOT NULL,
    source VARCHAR(64) DEFAULT 'APP' NOT NULL,
    created_by UUID, -- auth user_id of actor
    audit_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_trans_type CHECK (type IN (
        'VISIT',
        'PURCHASE',
        'BONUS',
        'REFERRAL',
        'BIRTHDAY',
        'MANUAL_ADJUSTMENT',
        'REWARD_REDEMPTION',
        'REVERSAL'
    )),
    CONSTRAINT chk_trans_non_zero CHECK (points_stamps != 0),
    CONSTRAINT chk_trans_balance_after CHECK (balance_after >= 0),
    CONSTRAINT uq_trans_tenant_idempotency UNIQUE (restaurant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_customer ON loyalty_transactions(restaurant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON loyalty_transactions(loyalty_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON loyalty_transactions(restaurant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. LOYALTY RULES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    rule_type VARCHAR(32) NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb NOT NULL,
    reward_points_stamps INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    valid_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_rules_type CHECK (rule_type IN ('PURCHASE_TIER', 'VISIT_MILESTONE', 'BONUS_EVENT', 'BIRTHDAY')),
    CONSTRAINT chk_rules_reward_points CHECK (reward_points_stamps > 0),
    CONSTRAINT chk_rules_valid_range CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rules_tenant ON loyalty_rules(restaurant_id, is_active);

-- ----------------------------------------------------------------------------
-- 9. REWARDS CATALOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(128) NOT NULL,
    description TEXT,
    image_url TEXT,
    cost_points_stamps INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    max_redemptions_per_customer INT,
    total_inventory INT,
    claimed_inventory INT DEFAULT 0 NOT NULL,
    valid_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_reward_cost CHECK (cost_points_stamps > 0),
    CONSTRAINT chk_reward_claimed_inv CHECK (claimed_inventory >= 0),
    CONSTRAINT chk_reward_total_inv CHECK (total_inventory IS NULL OR total_inventory >= 0),
    CONSTRAINT chk_reward_inv_limit CHECK (total_inventory IS NULL OR claimed_inventory <= total_inventory),
    CONSTRAINT chk_reward_max_per_cust CHECK (max_redemptions_per_customer IS NULL OR max_redemptions_per_customer > 0),
    CONSTRAINT chk_reward_date_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_rewards_tenant_active ON rewards(restaurant_id, is_active);

-- ----------------------------------------------------------------------------
-- 10. REWARD REDEMPTIONS (State Machine Managed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
    loyalty_transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE RESTRICT,
    code VARCHAR(16) NOT NULL,
    status VARCHAR(16) DEFAULT 'REQUESTED' NOT NULL,
    points_cost INT NOT NULL,
    idempotency_key VARCHAR(128),
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    redeemed_by_staff_id UUID REFERENCES restaurant_staff(id),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_redemption_status CHECK (status IN ('AVAILABLE', 'REQUESTED', 'ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT chk_redemption_cost CHECK (points_cost > 0),
    CONSTRAINT uq_redemptions_tenant_code UNIQUE (restaurant_id, code),
    CONSTRAINT uq_redemptions_tenant_idempotency UNIQUE (restaurant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_redemptions_lookup ON reward_redemptions(restaurant_id, code, status);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON reward_redemptions(restaurant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_expires ON reward_redemptions(expires_at) WHERE status = 'ISSUED';

-- ----------------------------------------------------------------------------
-- 11. CUSTOMER VISITS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    spend_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    points_or_stamp_earned INT DEFAULT 1 NOT NULL,
    recorded_by_staff_id UUID REFERENCES restaurant_staff(id),
    notes VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_visit_spend CHECK (spend_amount >= 0),
    CONSTRAINT chk_visit_earned CHECK (points_or_stamp_earned >= 0)
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant_customer ON visits(restaurant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_recorded_at ON visits(restaurant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 12. QR CODES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    label VARCHAR(128) NOT NULL,
    code_identifier VARCHAR(64) UNIQUE NOT NULL,
    location_tag VARCHAR(64),
    target_path VARCHAR(255) NOT NULL,
    scan_count INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_qr_scan_count CHECK (scan_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qrcodes_tenant ON qr_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qrcodes_identifier ON qr_codes(code_identifier);

-- ----------------------------------------------------------------------------
-- 13. AUDIT LOGS (Append-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_entity VARCHAR(64) NOT NULL,
    target_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(restaurant_id, action);
