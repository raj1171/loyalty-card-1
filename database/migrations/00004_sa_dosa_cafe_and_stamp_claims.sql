-- ============================================================================
-- Migration: 00004_sa_dosa_cafe_and_stamp_claims.sql
-- Description: S A Dosa Cafe tenant setup, social links, Google review URL,
--              stamp_claims table, and atomic cashier verification procedures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND RESTAURANTS & SETTINGS TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone_contact VARCHAR(32);

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS google_review_url TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ----------------------------------------------------------------------------
-- 2. STAMP CLAIMS TABLE & RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stamp_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    code VARCHAR(16) NOT NULL,
    status VARCHAR(16) DEFAULT 'CREATED' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    staff_user_id UUID,
    notes TEXT,
    CONSTRAINT chk_stamp_claim_status CHECK (status IN ('CREATED', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_stamp_claims_code ON stamp_claims(restaurant_id, code);
CREATE INDEX IF NOT EXISTS idx_stamp_claims_customer ON stamp_claims(customer_id, status);

ALTER TABLE stamp_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_claims FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "stamp_claims_select" ON stamp_claims;
    CREATE POLICY "stamp_claims_select" ON stamp_claims FOR SELECT
    USING (
        is_staff_of(restaurant_id)
        OR customer_id = current_customer_id()
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. ATOMIC STORED PROCEDURES FOR STAMP CLAIMS
-- ----------------------------------------------------------------------------

-- fn_create_stamp_claim: Customer requests short-lived single-use claim code
CREATE OR REPLACE FUNCTION fn_create_stamp_claim(
    p_restaurant_id UUID,
    p_customer_id UUID,
    p_ttl_minutes INT DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_code VARCHAR(16);
    v_claim_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Identity check: authenticated caller must be the customer
    IF current_auth_user_id() IS NOT NULL AND NOT is_current_customer(p_customer_id) THEN
        RAISE EXCEPTION 'Unauthorized: Cannot create stamp claim for another customer';
    END IF;

    -- 2. Return existing active unexpired claim code if one already exists
    SELECT id, code, expires_at INTO v_existing
    FROM stamp_claims
    WHERE restaurant_id = p_restaurant_id
      AND customer_id = p_customer_id
      AND status = 'CREATED'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'claim_id', v_existing.id,
            'code', v_existing.code,
            'expires_at', v_existing.expires_at,
            'status', 'CREATED',
            'is_existing', true
        );
    END IF;

    -- 3. Generate 6-digit numeric claim code (e.g. '482917')
    v_code := LPAD((FLOOR(random() * 900000) + 100000)::text, 6, '0');
    v_expires_at := NOW() + (p_ttl_minutes || ' minutes')::interval;

    INSERT INTO stamp_claims (
        restaurant_id,
        customer_id,
        code,
        status,
        created_at,
        expires_at
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        v_code,
        'CREATED',
        NOW(),
        v_expires_at
    ) RETURNING id INTO v_claim_id;

    RETURN jsonb_build_object(
        'claim_id', v_claim_id,
        'code', v_code,
        'expires_at', v_expires_at,
        'status', 'CREATED',
        'is_existing', false
    );
END;
$$;

-- fn_verify_stamp_claim: Cashier scans / enters code to preview customer
CREATE OR REPLACE FUNCTION fn_verify_stamp_claim(
    p_restaurant_id UUID,
    p_code VARCHAR,
    p_staff_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claim RECORD;
    v_customer RECORD;
    v_account RECORD;
    v_settings RECORD;
BEGIN
    -- 1. Identity check
    IF current_auth_user_id() IS NOT NULL AND current_auth_user_id() != p_staff_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot impersonate another staff member';
    END IF;

    IF current_auth_user_id() IS NOT NULL AND NOT is_staff_of(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an active staff member of this restaurant';
    END IF;

    -- 2. Lookup claim
    SELECT * INTO v_claim
    FROM stamp_claims
    WHERE restaurant_id = p_restaurant_id
      AND code = p_code
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim code not found';
    END IF;

    IF v_claim.status = 'CONSUMED' THEN
        RAISE EXCEPTION 'Claim code has already been used';
    END IF;

    IF v_claim.status != 'CREATED' OR v_claim.expires_at <= NOW() THEN
        RAISE EXCEPTION 'Claim code has expired or is invalid';
    END IF;

    -- 3. Lookup customer & balance
    SELECT id, full_name, phone INTO v_customer
    FROM customers WHERE id = v_claim.customer_id;

    SELECT current_balance INTO v_account
    FROM loyalty_accounts
    WHERE restaurant_id = p_restaurant_id AND customer_id = v_claim.customer_id;

    SELECT stamps_target_count INTO v_settings
    FROM restaurant_settings WHERE restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object(
        'claim_id', v_claim.id,
        'code', v_claim.code,
        'customer_id', v_customer.id,
        'customer_name', COALESCE(v_customer.full_name, 'Valued Customer'),
        'customer_phone', v_customer.phone,
        'current_stamps', COALESCE(v_account.current_balance, 0),
        'target_stamps', COALESCE(v_settings.stamps_target_count, 7),
        'expires_at', v_claim.expires_at,
        'eligible', true
    );
END;
$$;

-- fn_consume_stamp_claim: Cashier confirms stamp award atomically
CREATE OR REPLACE FUNCTION fn_consume_stamp_claim(
    p_restaurant_id UUID,
    p_code VARCHAR,
    p_staff_user_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claim RECORD;
    v_account RECORD;
    v_customer RECORD;
    v_settings RECORD;
    v_new_stamps INT;
    v_target_stamps INT;
    v_reward_unlocked BOOLEAN := FALSE;
    v_tx_id UUID;
BEGIN
    -- 1. Identity check
    IF current_auth_user_id() IS NOT NULL AND current_auth_user_id() != p_staff_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot impersonate another staff member';
    END IF;

    IF current_auth_user_id() IS NOT NULL AND NOT is_staff_of(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an active staff member of this restaurant';
    END IF;

    -- 2. Lock claim row FOR UPDATE
    SELECT * INTO v_claim
    FROM stamp_claims
    WHERE restaurant_id = p_restaurant_id
      AND code = p_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim code not found';
    END IF;

    IF v_claim.status = 'CONSUMED' THEN
        RAISE EXCEPTION 'Claim code has already been used';
    END IF;

    IF v_claim.status != 'CREATED' OR v_claim.expires_at <= NOW() THEN
        RAISE EXCEPTION 'Claim code has expired or is invalid';
    END IF;

    -- 3. Lock loyalty account FOR UPDATE
    SELECT * INTO v_account
    FROM loyalty_accounts
    WHERE restaurant_id = p_restaurant_id AND customer_id = v_claim.customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loyalty account not found for customer';
    END IF;

    SELECT stamps_target_count INTO v_settings
    FROM restaurant_settings WHERE restaurant_id = p_restaurant_id;
    v_target_stamps := COALESCE(v_settings.stamps_target_count, 7);

    -- 4. Mark claim consumed
    UPDATE stamp_claims
    SET status = 'CONSUMED',
        consumed_at = NOW(),
        staff_user_id = p_staff_user_id,
        notes = p_notes
    WHERE id = v_claim.id;

    -- 5. Award 1 stamp atomically
    v_new_stamps := v_account.current_balance + 1;

    UPDATE loyalty_accounts
    SET current_balance = v_new_stamps,
        lifetime_accrued = lifetime_accrued + 1,
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_account.id;

    -- 6. Insert into immutable ledger
    INSERT INTO loyalty_transactions (
        restaurant_id,
        customer_id,
        loyalty_account_id,
        type,
        points_stamps,
        balance_after,
        description,
        source,
        created_by
    ) VALUES (
        p_restaurant_id,
        v_claim.customer_id,
        v_account.id,
        'VISIT',
        1,
        v_new_stamps,
        COALESCE(p_notes, 'Visit stamp verified by cashier'),
        'STAFF',
        p_staff_user_id
    ) RETURNING id INTO v_tx_id;

    -- 7. Check if 7th stamp reached
    IF v_new_stamps >= v_target_stamps THEN
        v_reward_unlocked := TRUE;
    END IF;

    -- 8. Customer info
    SELECT full_name, phone INTO v_customer
    FROM customers WHERE id = v_claim.customer_id;

    -- 9. Audit event
    INSERT INTO audit_logs (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_entity,
        target_id,
        details
    ) VALUES (
        p_restaurant_id,
        p_staff_user_id,
        'STAFF',
        'STAMP_CLAIM_CONSUMED',
        'stamp_claims',
        v_claim.id,
        jsonb_build_object(
            'customer_id', v_claim.customer_id,
            'code', v_claim.code,
            'previous_stamps', v_account.current_balance,
            'new_stamps', v_new_stamps,
            'reward_unlocked', v_reward_unlocked
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_name', COALESCE(v_customer.full_name, 'Valued Customer'),
        'previous_stamps', v_account.current_balance,
        'new_stamps', v_new_stamps,
        'target_stamps', v_target_stamps,
        'reward_unlocked', v_reward_unlocked,
        'transaction_id', v_tx_id
    );
END;
$$;

-- Revoke execute from public safely
DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION fn_create_stamp_claim FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_verify_stamp_claim FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_consume_stamp_claim FROM PUBLIC, anon;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 4. SEED: S A DOSA CAFE RESTAURANT & BRAND CONFIGURATION
-- ----------------------------------------------------------------------------
INSERT INTO restaurants (
    id,
    slug,
    name,
    tagline,
    description,
    brand_color,
    accent_color,
    currency,
    is_active
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'sa-dosa-cafe',
    'SA Dosa Cafe',
    'Crispy Dosas. Real Filter Coffee. Authentic South Indian Vibes.',
    'Innovative fusion dosas and authentic South Indian classics crafted fresh daily with traditional batter and pure ingredients.',
    '#FF6310',
    '#059669',
    'STAMPS',
    TRUE
) ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    brand_color = EXCLUDED.brand_color,
    accent_color = EXCLUDED.accent_color,
    currency = EXCLUDED.currency,
    is_active = TRUE;

INSERT INTO restaurant_settings (
    restaurant_id,
    loyalty_model,
    points_per_currency_unit,
    stamps_target_count,
    stamp_minimum_spend,
    reward_expiry_days,
    redemption_code_ttl_minutes,
    welcome_bonus_points,
    welcome_bonus_stamps,
    instagram_url,
    facebook_url,
    google_review_url,
    website_url,
    terms_and_conditions
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'STAMPS',
    0.00,
    7,
    0.00,
    30,
    15,
    0,
    0,
    'https://www.instagram.com/sa_dosacafe/',
    'https://www.facebook.com/sadosacafe/',
    'https://search.google.com/local/writereview?placeid=ChIJsa-dosa-cafe-demo',
    'https://sadosacafe.com',
    'Collect 1 stamp per visit. Complete 7 stamps to unlock your Free Reward! One stamp per day.'
) ON CONFLICT (restaurant_id) DO UPDATE
SET loyalty_model = 'STAMPS',
    stamps_target_count = 7,
    instagram_url = EXCLUDED.instagram_url,
    facebook_url = EXCLUDED.facebook_url,
    google_review_url = EXCLUDED.google_review_url,
    website_url = EXCLUDED.website_url;

-- Configurable 7-stamp Reward: "FREE REWARD"
INSERT INTO rewards (
    id,
    restaurant_id,
    title,
    description,
    cost_points_stamps,
    is_active,
    max_redemptions_per_customer
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    'FREE REWARD',
    'Enjoy a complimentary signature Dosa or specialty Beverage on the house! Valid for 30 days once unlocked.',
    7,
    TRUE,
    NULL
) ON CONFLICT (id) DO NOTHING;

-- Staff for SA Dosa Cafe (Owner & Cashier)
INSERT INTO restaurant_staff (
    id,
    restaurant_id,
    user_id,
    email,
    full_name,
    role,
    is_active
) VALUES (
    'a7777777-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'c3333333-1111-1111-1111-111111111111',
    'owner@sadosacafe.com',
    'SA Dosa Cafe Owner',
    'OWNER',
    TRUE
) ON CONFLICT (restaurant_id, user_id) DO NOTHING;

INSERT INTO restaurant_staff (
    id,
    restaurant_id,
    user_id,
    email,
    full_name,
    role,
    is_active
) VALUES (
    'a7777777-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'c3333333-2222-2222-2222-222222222222',
    'cashier@sadosacafe.com',
    'SA Dosa Cashier',
    'STAFF',
    TRUE
) ON CONFLICT (restaurant_id, user_id) DO NOTHING;

-- Demo Customers:
-- Customer 1: Pradyumna (3 stamps out of 7 - demo stamp claiming)
INSERT INTO customers (
    id,
    user_id,
    phone,
    full_name,
    email
) VALUES (
    'd1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    '+919876543210',
    'Pradyumna Joshi',
    'pradyumna@example.com'
) ON CONFLICT (phone) DO UPDATE
SET full_name = EXCLUDED.full_name;

INSERT INTO customer_restaurant_memberships (
    restaurant_id,
    customer_id,
    membership_number
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'd1111111-1111-1111-1111-111111111111',
    'M-SADC-0001'
) ON CONFLICT (restaurant_id, customer_id) DO NOTHING;

INSERT INTO loyalty_accounts (
    restaurant_id,
    customer_id,
    loyalty_model,
    current_balance,
    lifetime_accrued
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'd1111111-1111-1111-1111-111111111111',
    'STAMPS',
    3,
    3
) ON CONFLICT (restaurant_id, customer_id) DO UPDATE
SET current_balance = 3;

-- Customer 2: Ananya (6 stamps out of 7 - demo 7th stamp unlock & celebration)
INSERT INTO customers (
    id,
    user_id,
    phone,
    full_name,
    email
) VALUES (
    'd2222222-2222-2222-2222-222222222222',
    'd2222222-2222-2222-2222-222222222222',
    '+919876543211',
    'Ananya Rao',
    'ananya@example.com'
) ON CONFLICT (phone) DO UPDATE
SET full_name = EXCLUDED.full_name;

INSERT INTO customer_restaurant_memberships (
    restaurant_id,
    customer_id,
    membership_number
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'd2222222-2222-2222-2222-222222222222',
    'M-SADC-0002'
) ON CONFLICT (restaurant_id, customer_id) DO NOTHING;

INSERT INTO loyalty_accounts (
    restaurant_id,
    customer_id,
    loyalty_model,
    current_balance,
    lifetime_accrued
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'd2222222-2222-2222-2222-222222222222',
    'STAMPS',
    6,
    6
) ON CONFLICT (restaurant_id, customer_id) DO UPDATE
SET current_balance = 6;
