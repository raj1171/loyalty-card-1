-- ============================================================================
-- Migration: 00003_rls_policies.sql
-- Description: Row Level Security (RLS) policies for complete multi-tenant,
--              customer, and staff/manager/owner role isolation.
-- ============================================================================

-- Enable and FORCE RLS on all 13 tables (forces RLS on table owners as well)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants FORCE ROW LEVEL SECURITY;

ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_staff FORCE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

ALTER TABLE customer_restaurant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_restaurant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards FORCE ROW LEVEL SECURITY;

ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions FORCE ROW LEVEL SECURITY;

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits FORCE ROW LEVEL SECURITY;

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 1. RESTAURANTS
-- ----------------------------------------------------------------------------
-- Public can view active restaurants (for QR landing & branding), or staff of that restaurant
CREATE POLICY "restaurants_select_active"
ON restaurants FOR SELECT
USING (is_active = TRUE OR is_staff_of(id));

-- Only owners can update their restaurant profile
CREATE POLICY "restaurants_update_owner"
ON restaurants FOR UPDATE
USING (is_owner_of(id))
WITH CHECK (is_owner_of(id));


-- ----------------------------------------------------------------------------
-- 2. RESTAURANT SETTINGS
-- ----------------------------------------------------------------------------
-- Public can view settings of active restaurants to render loyalty rules/terms
CREATE POLICY "restaurant_settings_select"
ON restaurant_settings FOR SELECT
USING (
    is_staff_of(restaurant_id)
    OR EXISTS (
        SELECT 1 FROM restaurants r
        WHERE r.id = restaurant_settings.restaurant_id
          AND r.is_active = TRUE
    )
);

-- Managers and owners can update loyalty settings
CREATE POLICY "restaurant_settings_update_mgr_owner"
ON restaurant_settings FOR UPDATE
USING (is_manager_or_owner_of(restaurant_id))
WITH CHECK (is_manager_or_owner_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 3. RESTAURANT STAFF (Multi-tenant staff management)
-- ----------------------------------------------------------------------------
-- Active staff of a restaurant can view fellow staff members
CREATE POLICY "restaurant_staff_select"
ON restaurant_staff FOR SELECT
USING (is_staff_of(restaurant_id));

-- Only restaurant OWNER can invite/insert staff
CREATE POLICY "restaurant_staff_insert_owner"
ON restaurant_staff FOR INSERT
WITH CHECK (is_owner_of(restaurant_id));

-- Only restaurant OWNER can update staff roles/status
CREATE POLICY "restaurant_staff_update_owner"
ON restaurant_staff FOR UPDATE
USING (is_owner_of(restaurant_id))
WITH CHECK (is_owner_of(restaurant_id));

-- Only restaurant OWNER can remove staff
CREATE POLICY "restaurant_staff_delete_owner"
ON restaurant_staff FOR DELETE
USING (is_owner_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 4. CUSTOMERS
-- ----------------------------------------------------------------------------
-- Customers can view their own record; staff can view customers who are members of their restaurant
CREATE POLICY "customers_select_self_or_staff"
ON customers FOR SELECT
USING (
    user_id = current_auth_user_id()
    OR EXISTS (
        SELECT 1 FROM customer_restaurant_memberships m
        WHERE m.customer_id = customers.id
          AND is_staff_of(m.restaurant_id)
    )
);

-- Customers can update their own profile information
CREATE POLICY "customers_update_self"
ON customers FOR UPDATE
USING (user_id = current_auth_user_id())
WITH CHECK (user_id = current_auth_user_id());

-- New customers can register (must match authenticated user)
CREATE POLICY "customers_insert"
ON customers FOR INSERT
WITH CHECK (user_id = current_auth_user_id());


-- ----------------------------------------------------------------------------
-- 5. CUSTOMER RESTAURANT MEMBERSHIPS
-- ----------------------------------------------------------------------------
-- Customer can view their own membership; staff can view memberships of their restaurant
CREATE POLICY "memberships_select"
ON customer_restaurant_memberships FOR SELECT
USING (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);

-- Customer or staff can join a restaurant
CREATE POLICY "memberships_insert"
ON customer_restaurant_memberships FOR INSERT
WITH CHECK (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);

-- Customer can deactivate or update their membership
CREATE POLICY "memberships_update"
ON customer_restaurant_memberships FOR UPDATE
USING (
    is_current_customer(customer_id)
    OR is_manager_or_owner_of(restaurant_id)
)
WITH CHECK (
    is_current_customer(customer_id)
    OR is_manager_or_owner_of(restaurant_id)
);


-- ----------------------------------------------------------------------------
-- 6. LOYALTY ACCOUNTS
-- ----------------------------------------------------------------------------
-- Customer can read own balance; staff can read customer balance for their restaurant
CREATE POLICY "loyalty_accounts_select"
ON loyalty_accounts FOR SELECT
USING (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);
-- Direct DML updates/inserts blocked for regular users; managed via SECURITY DEFINER functions


-- ----------------------------------------------------------------------------
-- 7. LOYALTY TRANSACTIONS (Auditable Ledger)
-- ----------------------------------------------------------------------------
-- Customer can view their own transaction history; staff can view transactions of their restaurant
CREATE POLICY "loyalty_transactions_select"
ON loyalty_transactions FOR SELECT
USING (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);
-- Direct client inserts, updates, and deletes are blocked. Handled via SECURITY DEFINER functions.


-- ----------------------------------------------------------------------------
-- 8. LOYALTY RULES
-- ----------------------------------------------------------------------------
-- Staff can view loyalty rules for their restaurant
CREATE POLICY "loyalty_rules_select"
ON loyalty_rules FOR SELECT
USING (is_staff_of(restaurant_id));

-- Manager or Owner can manage rules
CREATE POLICY "loyalty_rules_insert_mgr_owner"
ON loyalty_rules FOR INSERT
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "loyalty_rules_update_mgr_owner"
ON loyalty_rules FOR UPDATE
USING (is_manager_or_owner_of(restaurant_id))
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "loyalty_rules_delete_mgr_owner"
ON loyalty_rules FOR DELETE
USING (is_manager_or_owner_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 9. REWARDS (Tenant-Isolated Catalog)
-- ----------------------------------------------------------------------------
-- Staff see all rewards for their restaurant; Customers/public see active rewards
-- for the restaurant they are viewing or belong to
CREATE POLICY "rewards_select"
ON rewards FOR SELECT
USING (
    is_staff_of(restaurant_id)
    OR (
        is_active = TRUE AND (
            restaurant_id = NULLIF(current_setting('app.current_restaurant_id', true), '')::UUID
            OR EXISTS (
                SELECT 1 FROM customer_restaurant_memberships m
                WHERE m.restaurant_id = rewards.restaurant_id
                  AND is_current_customer(m.customer_id)
            )
        )
    )
);

-- Manager or Owner can manage rewards catalog
CREATE POLICY "rewards_insert_mgr_owner"
ON rewards FOR INSERT
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "rewards_update_mgr_owner"
ON rewards FOR UPDATE
USING (is_manager_or_owner_of(restaurant_id))
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "rewards_delete_mgr_owner"
ON rewards FOR DELETE
USING (is_manager_or_owner_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 10. REWARD REDEMPTIONS
-- ----------------------------------------------------------------------------
-- Customer can view own redemptions; staff can view redemptions for their restaurant
CREATE POLICY "reward_redemptions_select"
ON reward_redemptions FOR SELECT
USING (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);
-- Direct mutation handled via SECURITY DEFINER functions (fn_issue_reward_redemption, fn_fulfill_reward_redemption)


-- ----------------------------------------------------------------------------
-- 11. VISITS
-- ----------------------------------------------------------------------------
-- Customer can view own visits; staff can view visits for their restaurant
CREATE POLICY "visits_select"
ON visits FOR SELECT
USING (
    is_current_customer(customer_id)
    OR is_staff_of(restaurant_id)
);

-- Staff can record visits
CREATE POLICY "visits_insert_staff"
ON visits FOR INSERT
WITH CHECK (is_staff_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 12. QR CODES (Tenant-Isolated)
-- ----------------------------------------------------------------------------
-- Staff see all QR codes for their restaurant; public/customers see active QR codes
-- for the specific restaurant context
CREATE POLICY "qr_codes_select"
ON qr_codes FOR SELECT
USING (
    is_staff_of(restaurant_id)
    OR (
        is_active = TRUE AND (
            restaurant_id = NULLIF(current_setting('app.current_restaurant_id', true), '')::UUID
            OR code_identifier = NULLIF(current_setting('app.current_qr_code', true), '')
        )
    )
);

-- Manager or Owner can manage QR codes
CREATE POLICY "qr_codes_insert_mgr_owner"
ON qr_codes FOR INSERT
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "qr_codes_update_mgr_owner"
ON qr_codes FOR UPDATE
USING (is_manager_or_owner_of(restaurant_id))
WITH CHECK (is_manager_or_owner_of(restaurant_id));

CREATE POLICY "qr_codes_delete_mgr_owner"
ON qr_codes FOR DELETE
USING (is_manager_or_owner_of(restaurant_id));


-- ----------------------------------------------------------------------------
-- 13. AUDIT LOGS
-- ----------------------------------------------------------------------------
-- Only Manager or Owner can view audit logs for their restaurant (Staff cannot)
CREATE POLICY "audit_logs_select_mgr_owner"
ON audit_logs FOR SELECT
USING (is_manager_or_owner_of(restaurant_id));
-- Direct inserts/updates/deletes are strictly forbidden; audit logs are written exclusively via SECURITY DEFINER functions


-- ----------------------------------------------------------------------------
-- 14. STORED PROCEDURE RPC PERMISSION HARDENING
-- ----------------------------------------------------------------------------
-- Revoke public and anon execution on sensitive SECURITY DEFINER functions to prevent RPC exploitation
DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION fn_register_customer_membership(UUID, VARCHAR, UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_issue_reward_redemption(UUID, UUID, UUID, VARCHAR, INT) FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_fulfill_reward_redemption(UUID, VARCHAR, UUID, VARCHAR) FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_record_customer_visit(UUID, UUID, UUID, NUMERIC, VARCHAR, VARCHAR) FROM PUBLIC, anon;
    REVOKE EXECUTE ON FUNCTION fn_adjust_customer_balance(UUID, UUID, UUID, INT, VARCHAR) FROM PUBLIC, anon;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

