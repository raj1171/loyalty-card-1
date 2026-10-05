-- ============================================================================
-- Seed: 00001_demo_seed.sql
-- Description: Deterministic multi-tenant seed data for development and testing.
-- Features:
--   Tenant 1: The Artisan Coffee Roasters (POINTS model)
--   Tenant 2: Urban Bites Bistro (STAMPS model)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Static UUID definitions for predictable testing
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    -- Tenant 1 (Artisan Coffee)
    c_r1_id CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
    c_u_owner1 CONSTANT UUID := 'a1111111-1111-1111-1111-111111111111';
    c_u_mgr1 CONSTANT UUID := 'a2222222-2222-2222-2222-222222222222';
    c_u_staff1 CONSTANT UUID := 'a3333333-3333-3333-3333-333333333333';
    c_staff1_id UUID;

    -- Tenant 2 (Urban Bites)
    c_r2_id CONSTANT UUID := '22222222-2222-2222-2222-222222222222';
    c_u_owner2 CONSTANT UUID := 'b1111111-1111-1111-1111-111111111111';
    c_u_staff2 CONSTANT UUID := 'b2222222-2222-2222-2222-222222222222';

    -- Customers
    c_u_cust_a CONSTANT UUID := 'c1111111-1111-1111-1111-111111111111';
    c_cust_a_id UUID;
    c_u_cust_b CONSTANT UUID := 'c2222222-2222-2222-2222-222222222222';
    c_cust_b_id UUID;
    c_u_cust_c CONSTANT UUID := 'c3333333-3333-3333-3333-333333333333';
    c_cust_c_id UUID;

    -- Rewards
    c_reward_latte UUID;
    c_reward_pastry UUID;
    c_reward_beans UUID;
    c_reward_appetizer UUID;

    -- Accounts
    c_acc_a_r1 UUID;
    c_acc_b_r1 UUID;
    c_acc_c_r2 UUID;

    -- Trans & Redemption
    c_trans_id UUID;
    c_redemption_id UUID;
BEGIN
    -- 1. Insert Restaurants
    INSERT INTO restaurants (id, slug, name, tagline, brand_color, accent_color, currency)
    VALUES
        (c_r1_id, 'artisan-coffee', 'The Artisan Coffee Roasters', 'Specialty single-origin coffees & fresh pastries', '#D97706', '#B45309', 'USD'),
        (c_r2_id, 'urban-bites', 'Urban Bites Bistro', 'Farm-to-table lunch, craft bowls & seasonal salads', '#10B981', '#047857', 'USD')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 2. Insert Settings
    INSERT INTO restaurant_settings (
        restaurant_id, loyalty_model, points_per_currency_unit, stamps_target_count,
        stamp_minimum_spend, reward_expiry_days, redemption_code_ttl_minutes,
        welcome_bonus_points, welcome_bonus_stamps, terms_and_conditions
    ) VALUES
        (c_r1_id, 'POINTS', 10.00, 10, 0.00, 30, 20, 25, 0, '10 points per $1 spent. Rewards valid for 30 days.'),
        (c_r2_id, 'STAMPS', 1.00, 8, 12.00, 60, 15, 0, 1, 'Collect 8 stamps for a complimentary chef appetizer.')
    ON CONFLICT (restaurant_id) DO UPDATE SET loyalty_model = EXCLUDED.loyalty_model;

    -- 3. Insert Restaurant Staff
    INSERT INTO restaurant_staff (restaurant_id, user_id, email, full_name, role)
    VALUES
        (c_r1_id, c_u_owner1, 'owner@artisancoffee.com', 'Eleanor Vance', 'OWNER'),
        (c_r1_id, c_u_mgr1, 'manager@artisancoffee.com', 'Marcus Chen', 'MANAGER'),
        (c_r1_id, c_u_staff1, 'barista@artisancoffee.com', 'Samira Taylor', 'STAFF'),
        (c_r2_id, c_u_owner2, 'owner@urbanbites.com', 'David Miller', 'OWNER'),
        (c_r2_id, c_u_staff2, 'server@urbanbites.com', 'Chloe Dubois', 'STAFF')
    ON CONFLICT (restaurant_id, user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
    SELECT id INTO c_staff1_id FROM restaurant_staff WHERE restaurant_id = c_r1_id AND email = 'barista@artisancoffee.com';

    -- 4. Insert Customers
    INSERT INTO customers (user_id, phone, email, full_name, birthday)
    VALUES
        (c_u_cust_a, '+15551000001', 'alice@example.com', 'Alice Walker', '1992-05-14'),
        (c_u_cust_b, '+15551000002', 'bob@example.com', 'Bob Martinez', '1988-11-23'),
        (c_u_cust_c, '+15552000003', 'charlie@example.com', 'Charlie Zhang', '1995-08-30')
    ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

    SELECT id INTO c_cust_a_id FROM customers WHERE phone = '+15551000001';
    SELECT id INTO c_cust_b_id FROM customers WHERE phone = '+15551000002';
    SELECT id INTO c_cust_c_id FROM customers WHERE phone = '+15552000003';

    -- 5. Memberships
    INSERT INTO customer_restaurant_memberships (restaurant_id, customer_id, membership_number)
    VALUES
        (c_r1_id, c_cust_a_id, 'M-ART1-0001'),
        (c_r1_id, c_cust_b_id, 'M-ART1-0002'),
        (c_r2_id, c_cust_c_id, 'M-URB2-0001')
    ON CONFLICT (restaurant_id, customer_id) DO NOTHING;

    -- 6. Loyalty Accounts
    INSERT INTO loyalty_accounts (restaurant_id, customer_id, loyalty_model, current_balance, lifetime_accrued, lifetime_redeemed)
    VALUES
        (c_r1_id, c_cust_a_id, 'POINTS', 120, 220, 100),
        (c_r1_id, c_cust_b_id, 'POINTS', 45, 45, 0),
        (c_r2_id, c_cust_c_id, 'STAMPS', 4, 4, 0)
    ON CONFLICT (restaurant_id, customer_id) DO NOTHING;

    SELECT id INTO c_acc_a_r1 FROM loyalty_accounts WHERE restaurant_id = c_r1_id AND customer_id = c_cust_a_id;
    SELECT id INTO c_acc_b_r1 FROM loyalty_accounts WHERE restaurant_id = c_r1_id AND customer_id = c_cust_b_id;
    SELECT id INTO c_acc_c_r2 FROM loyalty_accounts WHERE restaurant_id = c_r2_id AND customer_id = c_cust_c_id;

    -- 7. Rewards Catalog
    INSERT INTO rewards (id, restaurant_id, title, description, cost_points_stamps, is_active, total_inventory, claimed_inventory)
    VALUES
        (gen_random_uuid(), c_r1_id, 'Free Specialty Latte', 'Any large espresso-based latte with dairy or alternative milk.', 50, TRUE, 500, 12),
        (gen_random_uuid(), c_r1_id, 'Fresh Baked Croissant or Scone', 'Select from our morning fresh pastry display.', 75, TRUE, 200, 5),
        (gen_random_uuid(), c_r1_id, 'Single-Origin Coffee Beans (250g)', 'Choice of Ethiopian Yirgacheffe or Colombian Geisha roast.', 200, TRUE, 50, 1),
        (gen_random_uuid(), c_r2_id, 'Signature Truffle Fries or Bruschetta', 'Choice of crispy truffle parmesan fries or heirloom tomato bruschetta.', 8, TRUE, 100, 3);

    -- 8. Seed Sample Loyalty Transactions (Tenant 1, Customer A)
    INSERT INTO loyalty_transactions (
        restaurant_id, customer_id, loyalty_account_id, type, points_stamps,
        balance_after, description, source
    ) VALUES
        (c_r1_id, c_cust_a_id, c_acc_a_r1, 'BONUS', 25, 25, 'Welcome Bonus', 'SYSTEM'),
        (c_r1_id, c_cust_a_id, c_acc_a_r1, 'PURCHASE', 195, 220, 'Order #1042 - Cold brew & avocado toast', 'STAFF_POS'),
        (c_r1_id, c_cust_a_id, c_acc_a_r1, 'REWARD_REDEMPTION', -50, 170, 'Redeemed: Free Specialty Latte', 'CUSTOMER_APP'),
        (c_r1_id, c_cust_a_id, c_acc_a_r1, 'REWARD_REDEMPTION', -50, 120, 'Redeemed: Free Specialty Latte', 'CUSTOMER_APP')
    ON CONFLICT DO NOTHING;

    -- 9. Seed Active Redemption for Customer A
    SELECT id INTO c_reward_latte FROM rewards WHERE restaurant_id = c_r1_id AND title = 'Free Specialty Latte' LIMIT 1;

    INSERT INTO reward_redemptions (
        restaurant_id, customer_id, reward_id, code, status, points_cost,
        issued_at, expires_at
    ) VALUES (
        c_r1_id, c_cust_a_id, c_reward_latte, 'RD-ART1-7788', 'ISSUED', 50,
        NOW(), NOW() + interval '20 minutes'
    ) ON CONFLICT (restaurant_id, code) DO NOTHING;

    -- 10. QR Codes
    INSERT INTO qr_codes (restaurant_id, label, code_identifier, location_tag, target_path)
    VALUES
        (c_r1_id, 'Front Counter Register', 'art-front-counter', 'counter_1', '/r/artisan-coffee?loc=counter_1'),
        (c_r1_id, 'Patio Table 4', 'art-patio-04', 'patio_4', '/r/artisan-coffee?loc=patio_4'),
        (c_r2_id, 'Main Dining Entrance', 'urb-entrance', 'entrance', '/r/urban-bites?loc=entrance')
    ON CONFLICT (code_identifier) DO NOTHING;

END $$;
