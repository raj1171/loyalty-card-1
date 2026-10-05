-- ============================================================================
-- Migration: 00002_functions_and_triggers.sql
-- Description: Business logic functions, ledger invariants, atomic redemption,
--              and audit logging triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUTHENTICATION & SESSION CONTEXT HELPERS
-- ----------------------------------------------------------------------------

-- Returns authenticated user_id from Supabase JWT claim, custom session variable, or auth.uid()
CREATE OR REPLACE FUNCTION current_auth_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID,
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        auth.uid()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns the staff role ('STAFF', 'MANAGER', 'OWNER') for the authenticated user at a specific restaurant
CREATE OR REPLACE FUNCTION get_auth_staff_role(p_restaurant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_user_id UUID;
    v_role VARCHAR;
BEGIN
    v_user_id := current_auth_user_id();
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT role INTO v_role
    FROM restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = v_user_id
      AND is_active = TRUE;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Checks if the authenticated user is active staff, manager, or owner
CREATE OR REPLACE FUNCTION is_staff_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_auth_staff_role(p_restaurant_id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Checks if the authenticated user is manager or owner
CREATE OR REPLACE FUNCTION is_manager_or_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    v_role := get_auth_staff_role(p_restaurant_id);
    RETURN v_role IN ('MANAGER', 'OWNER');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Checks if the authenticated user is owner
CREATE OR REPLACE FUNCTION is_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_auth_staff_role(p_restaurant_id) = 'OWNER';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Checks if the authenticated user is the target customer
CREATE OR REPLACE FUNCTION is_current_customer(p_customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_matched BOOLEAN;
BEGIN
    v_user_id := current_auth_user_id();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT (user_id = v_user_id) INTO v_matched
    FROM customers
    WHERE id = p_customer_id;

    RETURN COALESCE(v_matched, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON restaurants;
CREATE TRIGGER trg_restaurants_updated_at
BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at
BEFORE UPDATE ON restaurant_settings
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_staff_updated_at ON restaurant_staff;
CREATE TRIGGER trg_restaurant_staff_updated_at
BEFORE UPDATE ON restaurant_staff
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_accounts_updated_at ON loyalty_accounts;
CREATE TRIGGER trg_loyalty_accounts_updated_at
BEFORE UPDATE ON loyalty_accounts
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_rewards_updated_at ON rewards;
CREATE TRIGGER trg_rewards_updated_at
BEFORE UPDATE ON rewards
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ----------------------------------------------------------------------------
-- 3. IMMUTABILITY ENFORCERS (Append-Only Ledger & Audit Logs)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_modification_ledger()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Modifications and deletions are strictly prohibited on append-only tables.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loyalty_transactions_immutable ON loyalty_transactions;
CREATE TRIGGER trg_loyalty_transactions_immutable
BEFORE UPDATE OR DELETE ON loyalty_transactions
FOR EACH STATEMENT EXECUTE FUNCTION prevent_modification_ledger();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_modification_ledger();


-- ----------------------------------------------------------------------------
-- 4. CUSTOMER REGISTRATION & MEMBERSHIP INITIALIZATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_register_customer_membership(
    p_restaurant_id UUID,
    p_phone VARCHAR(32),
    p_user_id UUID DEFAULT NULL,
    p_full_name VARCHAR(128) DEFAULT NULL,
    p_email VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_membership_id UUID;
    v_membership_number VARCHAR(32);
    v_account_id UUID;
    v_settings restaurant_settings%ROWTYPE;
    v_welcome_points INT := 0;
    v_loyalty_model VARCHAR(16) := 'POINTS';
    v_transaction_id UUID := NULL;
BEGIN
    -- 1. Fetch restaurant settings
    SELECT * INTO v_settings
    FROM restaurant_settings
    WHERE restaurant_id = p_restaurant_id;

    IF FOUND THEN
        v_loyalty_model := v_settings.loyalty_model;
        IF v_loyalty_model = 'POINTS' THEN
            v_welcome_points := v_settings.welcome_bonus_points;
        ELSE
            v_welcome_points := v_settings.welcome_bonus_stamps;
        END IF;
    END IF;

    -- 2. Upsert customer identity by phone
    INSERT INTO customers (user_id, phone, full_name, email)
    VALUES (p_user_id, p_phone, p_full_name, p_email)
    ON CONFLICT (phone) DO UPDATE
    SET user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
        full_name = COALESCE(EXCLUDED.full_name, customers.full_name),
        email = COALESCE(EXCLUDED.email, customers.email),
        updated_at = NOW()
    RETURNING id INTO v_customer_id;

    -- 3. Check or generate membership
    SELECT id, membership_number INTO v_membership_id, v_membership_number
    FROM customer_restaurant_memberships
    WHERE restaurant_id = p_restaurant_id AND customer_id = v_customer_id;

    IF NOT FOUND THEN
        -- Generate readable membership number: M-XXXX-XXXX
        v_membership_number := 'M-' || UPPER(SUBSTRING(md5(gen_random_uuid()::text) FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(md5(gen_random_uuid()::text) FROM 5 FOR 4));

        INSERT INTO customer_restaurant_memberships (
            restaurant_id,
            customer_id,
            membership_number
        ) VALUES (
            p_restaurant_id,
            v_customer_id,
            v_membership_number
        ) RETURNING id INTO v_membership_id;

        -- Create loyalty account
        INSERT INTO loyalty_accounts (
            restaurant_id,
            customer_id,
            loyalty_model,
            current_balance,
            lifetime_accrued
        ) VALUES (
            p_restaurant_id,
            v_customer_id,
            v_loyalty_model,
            v_welcome_points,
            v_welcome_points
        ) RETURNING id INTO v_account_id;

        -- Record welcome bonus in ledger if applicable
        IF v_welcome_points > 0 THEN
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
                v_customer_id,
                v_account_id,
                'BONUS',
                v_welcome_points,
                v_welcome_points,
                'Welcome Bonus',
                'SYSTEM',
                p_user_id
            ) RETURNING id INTO v_transaction_id;
        END IF;
    ELSE
        SELECT id INTO v_account_id
        FROM loyalty_accounts
        WHERE restaurant_id = p_restaurant_id AND customer_id = v_customer_id;
    END IF;

    RETURN jsonb_build_object(
        'customer_id', v_customer_id,
        'membership_id', v_membership_id,
        'membership_number', v_membership_number,
        'loyalty_account_id', v_account_id,
        'initial_balance', v_welcome_points
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. ATOMIC REWARD REDEMPTION ISSUANCE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_issue_reward_redemption(
    p_restaurant_id UUID,
    p_customer_id UUID,
    p_reward_id UUID,
    p_idempotency_key VARCHAR(128) DEFAULT NULL,
    p_ttl_minutes INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account loyalty_accounts%ROWTYPE;
    v_reward rewards%ROWTYPE;
    v_settings restaurant_settings%ROWTYPE;
    v_code VARCHAR(16);
    v_redemption_id UUID;
    v_transaction_id UUID;
    v_new_balance INT;
    v_ttl INT;
    v_expires_at TIMESTAMPTZ;
    v_existing_redemption reward_redemptions%ROWTYPE;
    v_customer_redemptions_count INT;
BEGIN
    -- 0. Authorization check: if authenticated caller is present, verify they own the customer account or are staff
    IF current_auth_user_id() IS NOT NULL AND NOT is_current_customer(p_customer_id) AND NOT is_staff_of(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot redeem rewards for another customer';
    END IF;

    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_redemption
        FROM reward_redemptions
        WHERE restaurant_id = p_restaurant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'status', v_existing_redemption.status,
                'redemption_id', v_existing_redemption.id,
                'code', v_existing_redemption.code,
                'expires_at', v_existing_redemption.expires_at,
                'points_cost', v_existing_redemption.points_cost,
                'is_idempotent_replay', TRUE
            );
        END IF;
    END IF;

    -- 2. Lock & Validate Loyalty Account
    SELECT * INTO v_account
    FROM loyalty_accounts
    WHERE restaurant_id = p_restaurant_id AND customer_id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loyalty account not found for customer in this restaurant';
    END IF;

    -- 3. Lock & Validate Reward
    SELECT * INTO v_reward
    FROM rewards
    WHERE id = p_reward_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reward not found';
    END IF;

    IF NOT v_reward.is_active THEN
        RAISE EXCEPTION 'Reward is currently inactive';
    END IF;

    IF v_reward.valid_from > NOW() THEN
        RAISE EXCEPTION 'Reward is not yet valid';
    END IF;

    IF v_reward.valid_until IS NOT NULL AND v_reward.valid_until < NOW() THEN
        RAISE EXCEPTION 'Reward has expired';
    END IF;

    IF v_reward.total_inventory IS NOT NULL AND v_reward.claimed_inventory >= v_reward.total_inventory THEN
        RAISE EXCEPTION 'Reward inventory exhausted';
    END IF;

    -- 4. Customer limit check
    IF v_reward.max_redemptions_per_customer IS NOT NULL THEN
        SELECT COUNT(*) INTO v_customer_redemptions_count
        FROM reward_redemptions
        WHERE restaurant_id = p_restaurant_id
          AND customer_id = p_customer_id
          AND reward_id = p_reward_id
          AND status IN ('REQUESTED', 'ISSUED', 'REDEEMED');

        IF v_customer_redemptions_count >= v_reward.max_redemptions_per_customer THEN
            RAISE EXCEPTION 'Customer redemption limit reached for this reward';
        END IF;
    END IF;

    -- 5. Balance sufficiency check
    IF v_account.current_balance < v_reward.cost_points_stamps THEN
        RAISE EXCEPTION 'Insufficient balance: required %, available %', v_reward.cost_points_stamps, v_account.current_balance;
    END IF;

    -- 6. Resolve TTL
    IF p_ttl_minutes IS NOT NULL AND p_ttl_minutes > 0 THEN
        v_ttl := p_ttl_minutes;
    ELSE
        SELECT redemption_code_ttl_minutes INTO v_ttl
        FROM restaurant_settings
        WHERE restaurant_id = p_restaurant_id;
        v_ttl := COALESCE(v_ttl, 15);
    END IF;
    v_expires_at := NOW() + (v_ttl || ' minutes')::interval;

    -- 7. Generate secure 8-character unique alphanumeric redemption code: RD-XXXX-XXXX
    v_code := 'RD-' || UPPER(SUBSTRING(md5(gen_random_uuid()::text) FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(md5(gen_random_uuid()::text) FROM 5 FOR 4));

    -- 8. Deduct balance & insert immutable ledger record
    v_new_balance := v_account.current_balance - v_reward.cost_points_stamps;

    INSERT INTO loyalty_transactions (
        restaurant_id,
        customer_id,
        loyalty_account_id,
        type,
        points_stamps,
        balance_after,
        reference_id,
        idempotency_key,
        description,
        source,
        created_by
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        v_account.id,
        'REWARD_REDEMPTION',
        -v_reward.cost_points_stamps,
        v_new_balance,
        p_reward_id::text,
        p_idempotency_key,
        'Redeemed: ' || v_reward.title,
        'CUSTOMER_APP',
        current_auth_user_id()
    ) RETURNING id INTO v_transaction_id;

    -- 9. Update cached balance
    UPDATE loyalty_accounts
    SET current_balance = v_new_balance,
        lifetime_redeemed = lifetime_redeemed + v_reward.cost_points_stamps,
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_account.id;

    -- 10. Increment reward claimed inventory
    UPDATE rewards
    SET claimed_inventory = claimed_inventory + 1,
        updated_at = NOW()
    WHERE id = v_reward.id;

    -- 11. Create redemption record
    INSERT INTO reward_redemptions (
        restaurant_id,
        customer_id,
        reward_id,
        loyalty_transaction_id,
        code,
        status,
        points_cost,
        idempotency_key,
        requested_at,
        issued_at,
        expires_at
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        v_reward.id,
        v_transaction_id,
        v_code,
        'ISSUED',
        v_reward.cost_points_stamps,
        p_idempotency_key,
        NOW(),
        NOW(),
        v_expires_at
    ) RETURNING id INTO v_redemption_id;

    -- 12. Record audit log
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
        current_auth_user_id(),
        'CUSTOMER',
        'REWARD_ISSUED',
        'reward_redemptions',
        v_redemption_id::text,
        jsonb_build_object(
            'reward_id', p_reward_id,
            'reward_title', v_reward.title,
            'points_cost', v_reward.cost_points_stamps,
            'code', v_code,
            'expires_at', v_expires_at
        )
    );

    RETURN jsonb_build_object(
        'status', 'ISSUED',
        'redemption_id', v_redemption_id,
        'code', v_code,
        'expires_at', v_expires_at,
        'points_cost', v_reward.cost_points_stamps,
        'remaining_balance', v_new_balance,
        'is_idempotent_replay', FALSE
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. ATOMIC REWARD REDEMPTION FULFILLMENT (Staff In-Store Verification)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_fulfill_reward_redemption(
    p_restaurant_id UUID,
    p_code VARCHAR(16),
    p_staff_user_id UUID,
    p_notes VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_staff_id UUID;
    v_staff_role VARCHAR;
    v_redemption reward_redemptions%ROWTYPE;
    v_reward rewards%ROWTYPE;
    v_customer customers%ROWTYPE;
BEGIN
    -- 0. Authorization check: if authenticated caller is present, prevent staff impersonation
    IF current_auth_user_id() IS NOT NULL AND current_auth_user_id() != p_staff_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot impersonate another staff member';
    END IF;

    -- 1. Verify staff existence & membership in this restaurant
    SELECT id, role INTO v_staff_id, v_staff_role
    FROM restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = p_staff_user_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: User is not active staff of this restaurant';
    END IF;

    -- 2. Lock redemption record
    SELECT * INTO v_redemption
    FROM reward_redemptions
    WHERE restaurant_id = p_restaurant_id AND code = UPPER(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Redemption code not found';
    END IF;

    -- 3. Verify state machine invariants
    IF v_redemption.status = 'REDEEMED' THEN
        RAISE EXCEPTION 'Code has already been redeemed at %', v_redemption.redeemed_at;
    END IF;

    IF v_redemption.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Redemption code has been cancelled';
    END IF;

    IF v_redemption.status = 'EXPIRED' OR v_redemption.expires_at < NOW() THEN
        -- Mark as expired if not already marked
        UPDATE reward_redemptions
        SET status = 'EXPIRED'
        WHERE id = v_redemption.id;
        RAISE EXCEPTION 'Redemption code expired at %', v_redemption.expires_at;
    END IF;

    IF v_redemption.status != 'ISSUED' THEN
        RAISE EXCEPTION 'Invalid redemption status: %', v_redemption.status;
    END IF;

    -- 4. Mark REDEEMED
    UPDATE reward_redemptions
    SET status = 'REDEEMED',
        redeemed_at = NOW(),
        redeemed_by_staff_id = v_staff_id
    WHERE id = v_redemption.id;

    -- 5. Fetch associated reward and customer for receipt payload
    SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;
    SELECT * INTO v_customer FROM customers WHERE id = v_redemption.customer_id;

    -- 6. Audit log
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
        v_staff_role,
        'REWARD_FULFILLED',
        'reward_redemptions',
        v_redemption.id::text,
        jsonb_build_object(
            'code', v_redemption.code,
            'reward_id', v_reward.id,
            'reward_title', v_reward.title,
            'customer_phone', v_customer.phone,
            'notes', p_notes
        )
    );

    RETURN jsonb_build_object(
        'status', 'REDEEMED',
        'redemption_id', v_redemption.id,
        'code', v_redemption.code,
        'reward_title', v_reward.title,
        'customer_name', COALESCE(v_customer.full_name, 'Valued Customer'),
        'customer_phone', v_customer.phone,
        'redeemed_at', NOW(),
        'redeemed_by_staff_id', v_staff_id
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. RECORD VISIT & LOYALTY ACCRUAL (Staff POS / Visit Logging)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_record_customer_visit(
    p_restaurant_id UUID,
    p_customer_id UUID,
    p_staff_user_id UUID,
    p_spend_amount NUMERIC(10, 2) DEFAULT 0.00,
    p_notes VARCHAR(255) DEFAULT NULL,
    p_idempotency_key VARCHAR(128) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_staff_id UUID;
    v_settings restaurant_settings%ROWTYPE;
    v_account loyalty_accounts%ROWTYPE;
    v_accrued INT := 0;
    v_new_balance INT;
    v_visit_id UUID;
    v_transaction_id UUID;
    v_existing_visit visits%ROWTYPE;
BEGIN
    -- 0. Authorization check: if authenticated caller is present, prevent staff impersonation
    IF current_auth_user_id() IS NOT NULL AND current_auth_user_id() != p_staff_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot impersonate another staff member';
    END IF;

    -- 1. Verify staff permissions
    SELECT id INTO v_staff_id
    FROM restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = p_staff_user_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: User is not active staff of this restaurant';
    END IF;

    -- 2. Fetch settings
    SELECT * INTO v_settings
    FROM restaurant_settings
    WHERE restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant settings not found';
    END IF;

    -- 3. Calculate points or stamps earned
    IF v_settings.loyalty_model = 'POINTS' THEN
        -- Points = spend * points_per_currency_unit (minimum 1 if spend > 0)
        v_accrued := FLOOR(p_spend_amount * v_settings.points_per_currency_unit);
        IF v_accrued = 0 AND p_spend_amount > 0 THEN
            v_accrued := 1;
        END IF;
    ELSE
        -- STAMPS: 1 stamp per visit if spend satisfies stamp_minimum_spend
        IF p_spend_amount >= v_settings.stamp_minimum_spend THEN
            v_accrued := 1;
        ELSE
            v_accrued := 0;
        END IF;
    END IF;

    -- 4. Lock loyalty account
    SELECT * INTO v_account
    FROM loyalty_accounts
    WHERE restaurant_id = p_restaurant_id AND customer_id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loyalty account not found for customer';
    END IF;

    v_new_balance := v_account.current_balance + v_accrued;

    -- 5. Record visit
    INSERT INTO visits (
        restaurant_id,
        customer_id,
        spend_amount,
        points_or_stamp_earned,
        recorded_by_staff_id,
        notes
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        p_spend_amount,
        v_accrued,
        v_staff_id,
        p_notes
    ) RETURNING id INTO v_visit_id;

    -- 6. Insert ledger transaction if points/stamps accrued
    IF v_accrued > 0 THEN
        INSERT INTO loyalty_transactions (
            restaurant_id,
            customer_id,
            loyalty_account_id,
            type,
            points_stamps,
            balance_after,
            reference_id,
            idempotency_key,
            description,
            source,
            created_by
        ) VALUES (
            p_restaurant_id,
            p_customer_id,
            v_account.id,
            CASE WHEN v_settings.loyalty_model = 'POINTS' THEN 'PURCHASE' ELSE 'VISIT' END,
            v_accrued,
            v_new_balance,
            v_visit_id::text,
            p_idempotency_key,
            'Visit Accrual: ' || v_accrued || ' ' || LOWER(v_settings.loyalty_model),
            'STAFF_POS',
            p_staff_user_id
        ) RETURNING id INTO v_transaction_id;

        -- Update account balance
        UPDATE loyalty_accounts
        SET current_balance = v_new_balance,
            lifetime_accrued = lifetime_accrued + v_accrued,
            version = version + 1,
            updated_at = NOW()
        WHERE id = v_account.id;
    END IF;

    -- Update last activity on membership
    UPDATE customer_restaurant_memberships
    SET last_activity_at = NOW()
    WHERE restaurant_id = p_restaurant_id AND customer_id = p_customer_id;

    RETURN jsonb_build_object(
        'visit_id', v_visit_id,
        'points_or_stamps_earned', v_accrued,
        'new_balance', v_new_balance,
        'loyalty_model', v_settings.loyalty_model
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. ATOMIC BALANCE ADJUSTMENT (Manager / Owner)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_adjust_customer_balance(
    p_restaurant_id UUID,
    p_customer_id UUID,
    p_staff_user_id UUID,
    p_points_stamps INT,
    p_reason VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role VARCHAR;
    v_account loyalty_accounts%ROWTYPE;
    v_new_balance INT;
    v_transaction_id UUID;
BEGIN
    -- 1. Authorization check: caller must be MANAGER or OWNER of target restaurant
    IF current_auth_user_id() IS NOT NULL AND current_auth_user_id() != p_staff_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot impersonate another staff member';
    END IF;

    SELECT role INTO v_role
    FROM restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = p_staff_user_id
      AND is_active = TRUE;

    IF v_role IS NULL OR v_role NOT IN ('MANAGER', 'OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: Only Manager or Owner can perform manual balance adjustments';
    END IF;

    -- 2. Lock loyalty account FOR UPDATE
    SELECT * INTO v_account
    FROM loyalty_accounts
    WHERE restaurant_id = p_restaurant_id AND customer_id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loyalty account not found for customer';
    END IF;

    v_new_balance := v_account.current_balance + p_points_stamps;
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Adjustment would result in negative balance';
    END IF;

    -- 3. Update account balance
    UPDATE loyalty_accounts
    SET current_balance = v_new_balance,
        lifetime_accrued = lifetime_accrued + (CASE WHEN p_points_stamps > 0 THEN p_points_stamps ELSE 0 END),
        lifetime_redeemed = lifetime_redeemed + (CASE WHEN p_points_stamps < 0 THEN ABS(p_points_stamps) ELSE 0 END),
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_account.id;

    -- 4. Insert into immutable ledger
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
        p_customer_id,
        v_account.id,
        'MANUAL_ADJUSTMENT',
        p_points_stamps,
        v_new_balance,
        p_reason,
        'STAFF',
        p_staff_user_id
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'transaction_id', v_transaction_id,
        'current_balance', v_new_balance
    );
END;
$$;

