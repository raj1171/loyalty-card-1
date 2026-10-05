import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

// ANSI terminal colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    } else {
        failedTests++;
        console.error(`  ${RED}✗ FAIL:${RESET} ${testName}`);
        if (errorDetail) {
            console.error(`    ${YELLOW}Details:${RESET} ${errorDetail}`);
        }
    }
}

async function runTestSuite() {
    console.log(`\n${BOLD}${CYAN}======================================================${RESET}`);
    console.log(`${BOLD}${CYAN}   DIGITAL LOYALTY PLATFORM - DATABASE TEST SUITE     ${RESET}`);
    console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);

    const db = new PGlite();

    // ------------------------------------------------------------------------
    // Step 1: Run Migrations & Seeds
    // ------------------------------------------------------------------------
    console.log(`${BOLD}Applying Migrations & Seeds...${RESET}`);

    const migrationDir = path.resolve('database/migrations');
    const seedDir = path.resolve('database/seeds');

    const m1 = fs.readFileSync(path.join(migrationDir, '00001_initial_schema.sql'), 'utf-8');
    const m2 = fs.readFileSync(path.join(migrationDir, '00002_functions_and_triggers.sql'), 'utf-8');
    const m3 = fs.readFileSync(path.join(migrationDir, '00003_rls_policies.sql'), 'utf-8');
    const m4 = fs.readFileSync(path.join(migrationDir, '00004_sa_dosa_cafe_and_stamp_claims.sql'), 'utf-8');
    const s1 = fs.readFileSync(path.join(seedDir, '00001_demo_seed.sql'), 'utf-8');

    await db.exec(m1);
    console.log(`  ${GREEN}✓${RESET} 00001_initial_schema.sql applied`);
    await db.exec(m2);
    console.log(`  ${GREEN}✓${RESET} 00002_functions_and_triggers.sql applied`);
    await db.exec(m3);
    console.log(`  ${GREEN}✓${RESET} 00003_rls_policies.sql applied`);
    await db.exec(m4);
    console.log(`  ${GREEN}✓${RESET} 00004_sa_dosa_cafe_and_stamp_claims.sql applied`);
    await db.exec(s1);
    console.log(`  ${GREEN}✓${RESET} 00001_demo_seed.sql applied`);

    // Create standard non-superuser application role to enforce RLS (matching Supabase authenticated/anon behavior)
    await db.exec(`
        CREATE ROLE loyalty_app_user NOSUPERUSER;
        GRANT USAGE ON SCHEMA public TO loyalty_app_user;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO loyalty_app_user;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO loyalty_app_user;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO loyalty_app_user;
    `);

    // Helper to simulate authentication context as a non-superuser
    async function setAuthContext(userId: string | null, role: 'authenticated' | 'anon' = 'authenticated') {
        await db.exec(`RESET ROLE;`);
        if (userId) {
            await db.exec(`SET SESSION "request.jwt.claim.sub" = '${userId}';`);
            await db.exec(`SET SESSION "request.jwt.claim.role" = '${role}';`);
            await db.exec(`SET SESSION "app.current_user_id" = '${userId}';`);
        } else {
            await db.exec(`SET SESSION "request.jwt.claim.sub" = '';`);
            await db.exec(`SET SESSION "request.jwt.claim.role" = 'anon';`);
            await db.exec(`SET SESSION "app.current_user_id" = '';`);
        }
        await db.exec(`SET ROLE loyalty_app_user;`);
    }

    async function resetToSuperuser() {
        await db.exec(`RESET ROLE;`);
    }

    // Static test IDs defined in seed
    const R1_ID = '11111111-1111-1111-1111-111111111111'; // Artisan Coffee
    const R2_ID = '22222222-2222-2222-2222-222222222222'; // Urban Bites
    const U_OWNER1 = 'a1111111-1111-1111-1111-111111111111';
    const U_MGR1 = 'a2222222-2222-2222-2222-222222222222';
    const U_STAFF1 = 'a3333333-3333-3333-3333-333333333333';
    const U_OWNER2 = 'b1111111-1111-1111-1111-111111111111';
    const U_STAFF2 = 'b2222222-2222-2222-2222-222222222222';
    const U_CUST_A = 'c1111111-1111-1111-1111-111111111111';
    const U_CUST_B = 'c2222222-2222-2222-2222-222222222222';
    const U_CUST_C = 'c3333333-3333-3333-3333-333333333333';

    // ------------------------------------------------------------------------
    // TEST SUITE 1: Schema Validation & Constraints
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 1: Schema Validation & Constraints ---${RESET}`);
    await resetToSuperuser();

    // Check table count
    const tableRes = await db.query<{ count: string }>(`
        SELECT COUNT(*)::text as count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'restaurants', 'restaurant_settings', 'restaurant_staff',
            'customers', 'customer_restaurant_memberships', 'loyalty_accounts',
            'loyalty_transactions', 'loyalty_rules', 'rewards',
            'reward_redemptions', 'visits', 'qr_codes', 'audit_logs'
          );
    `);
    assert(tableRes.rows[0].count === '13', 'All 13 core tables exist in schema');

    // Unique slug constraint
    let slugFailed = false;
    try {
        await db.query(`
            INSERT INTO restaurants (slug, name) 
            VALUES ('artisan-coffee', 'Duplicate Slug Restaurant');
        `);
    } catch {
        slugFailed = true;
    }
    assert(slugFailed, 'Reject duplicate restaurant slug (UNIQUE constraint)');

    // Positive balance constraint
    let balanceFailed = false;
    try {
        await db.query(`
            INSERT INTO loyalty_accounts (restaurant_id, customer_id, loyalty_model, current_balance)
            VALUES ('${R1_ID}', (SELECT id FROM customers WHERE phone = '+15551000001'), 'POINTS', -10);
        `);
    } catch {
        balanceFailed = true;
    }
    assert(balanceFailed, 'Reject negative balance in loyalty_accounts (CHECK constraint)');

    // Append-only ledger invariant: Reject UPDATE on loyalty_transactions
    let updateTransFailed = false;
    try {
        await db.query(`
            UPDATE loyalty_transactions 
            SET points_stamps = 9999 
            WHERE restaurant_id = '${R1_ID}';
        `);
    } catch {
        updateTransFailed = true;
    }
    assert(updateTransFailed, 'Ledger Invariant: Prohibit UPDATE on loyalty_transactions (Statement Trigger)');

    // Append-only ledger invariant: Reject DELETE on loyalty_transactions
    let deleteTransFailed = false;
    try {
        await db.query(`
            DELETE FROM loyalty_transactions WHERE restaurant_id = '${R1_ID}';
        `);
    } catch {
        deleteTransFailed = true;
    }
    assert(deleteTransFailed, 'Ledger Invariant: Prohibit DELETE on loyalty_transactions (Statement Trigger)');

    // Immutability of audit_logs
    let deleteAuditFailed = false;
    try {
        await db.query(`
            DELETE FROM audit_logs WHERE restaurant_id = '${R1_ID}';
        `);
    } catch {
        deleteAuditFailed = true;
    }
    assert(deleteAuditFailed, 'Immutability: Prohibit DELETE on audit_logs (Statement Trigger)');

    // ------------------------------------------------------------------------
    // TEST SUITE 2: Multi-Tenant Data Isolation (Restaurant A vs Restaurant B)
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 2: Multi-Tenant Data Isolation ---${RESET}`);

    // Context: Staff 1 (Artisan Coffee)
    await setAuthContext(U_STAFF1);

    // Staff 1 reads rewards
    const staff1Rewards = await db.query<{ restaurant_id: string }>(`SELECT restaurant_id FROM rewards;`);
    const allR1Rewards = staff1Rewards.rows.every(r => r.restaurant_id === R1_ID);
    const hasR2Reward = staff1Rewards.rows.some(r => r.restaurant_id === R2_ID);
    assert(allR1Rewards && !hasR2Reward && staff1Rewards.rows.length > 0, 
        'Staff of Restaurant A cannot see Restaurant B rewards (RLS isolated)');

    // Staff 1 reads loyalty transactions
    const staff1Ledger = await db.query<{ restaurant_id: string }>(`SELECT restaurant_id FROM loyalty_transactions;`);
    const allR1Ledger = staff1Ledger.rows.every(t => t.restaurant_id === R1_ID);
    const hasR2Ledger = staff1Ledger.rows.some(t => t.restaurant_id === R2_ID);
    assert(allR1Ledger && !hasR2Ledger && staff1Ledger.rows.length > 0,
        'Staff of Restaurant A cannot see Restaurant B loyalty ledger entries (RLS isolated)');

    // Staff 1 reads restaurant staff
    const staff1Colleagues = await db.query<{ restaurant_id: string }>(`SELECT restaurant_id FROM restaurant_staff;`);
    const allR1Staff = staff1Colleagues.rows.every(s => s.restaurant_id === R1_ID);
    const hasR2Staff = staff1Colleagues.rows.some(s => s.restaurant_id === R2_ID);
    assert(allR1Staff && !hasR2Staff && staff1Colleagues.rows.length === 3,
        'Staff of Restaurant A cannot see Restaurant B staff list (RLS isolated)');

    // Staff 1 reads QR codes
    const staff1QRCodes = await db.query<{ restaurant_id: string }>(`SELECT restaurant_id FROM qr_codes;`);
    const allR1QR = staff1QRCodes.rows.every(q => q.restaurant_id === R1_ID);
    const hasR2QR = staff1QRCodes.rows.some(q => q.restaurant_id === R2_ID);
    assert(allR1QR && !hasR2QR && staff1QRCodes.rows.length === 2,
        'Staff of Restaurant A cannot see Restaurant B internal QR codes (RLS isolated)');

    // Cross-tenant fulfillment rejection: Staff 1 trying to fulfill for Restaurant 2
    let crossFulfillFailed = false;
    try {
        await db.query(`
            SELECT fn_fulfill_reward_redemption(
                '${R2_ID}'::uuid,
                'RD-ANY-CODE',
                '${U_STAFF1}'::uuid
            );
        `);
    } catch {
        crossFulfillFailed = true;
    }
    assert(crossFulfillFailed, 'Cross-Tenant: Staff A cannot fulfill or access redemptions in Restaurant B');

    // ------------------------------------------------------------------------
    // TEST SUITE 3: Customer Isolation (Customer A vs Customer B)
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 3: Customer Isolation ---${RESET}`);

    // Context: Customer A (Alice)
    await setAuthContext(U_CUST_A);

    // Customer A reads loyalty accounts
    const allCustAAccounts = await db.query<{ customer_id: string }>(`SELECT customer_id FROM loyalty_accounts;`);
    const custBCustId = (await resetToSuperuser().then(() => db.query<{ id: string }>(`SELECT id FROM customers WHERE user_id = '${U_CUST_B}';`))).rows[0].id;
    await setAuthContext(U_CUST_A);

    const sawCustomerBAccount = allCustAAccounts.rows.some(a => a.customer_id === custBCustId);
    assert(!sawCustomerBAccount && allCustAAccounts.rows.length === 1,
        'Customer A can only view their own loyalty account balance');

    // Customer A reads transactions
    const custATransactions = await db.query<{ customer_id: string }>(`SELECT customer_id FROM loyalty_transactions;`);
    const sawCustomerBTrans = custATransactions.rows.some(t => t.customer_id === custBCustId);
    assert(!sawCustomerBTrans && custATransactions.rows.length === 4,
        'Customer A cannot view Customer B loyalty transactions');

    // Customer A reads redemptions
    const custARedemptions = await db.query<{ code: string }>(`SELECT code FROM reward_redemptions;`);
    assert(custARedemptions.rows.length === 1 && custARedemptions.rows[0].code === 'RD-ART1-7788',
        'Customer A can view their active redemption code, but no other customer redemptions');

    // Customer A tries to update Customer B profile
    await db.query(`
        UPDATE customers 
        SET full_name = 'Hacked Name' 
        WHERE user_id = '${U_CUST_B}';
    `);
    // RLS policy prevents updating rows where user_id != current_auth_user_id (0 rows updated)
    await resetToSuperuser();
    const checkCustBName = await db.query<{ full_name: string }>(`SELECT full_name FROM customers WHERE user_id = '${U_CUST_B}';`);
    assert(checkCustBName.rows[0].full_name === 'Bob Martinez',
        'Customer A cannot update Customer B profile (RLS blocks row visibility and update)');

    // ------------------------------------------------------------------------
    // TEST SUITE 4: Role-Based Access Control (Staff vs Manager vs Owner)
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 4: Role-Based Access Control (Staff/Mgr/Owner) ---${RESET}`);

    // Context: Staff 1 (Barista)
    await setAuthContext(U_STAFF1);

    // Staff cannot update restaurant settings (RLS blocks update)
    await db.query(`
        UPDATE restaurant_settings 
        SET points_per_currency_unit = 999.00 
        WHERE restaurant_id = '${R1_ID}';
    `);
    await resetToSuperuser();
    const checkSettingsUnchanged = await db.query<{ points_per_currency_unit: string }>(`
        SELECT points_per_currency_unit::text FROM restaurant_settings WHERE restaurant_id = '${R1_ID}';
    `);
    assert(checkSettingsUnchanged.rows[0].points_per_currency_unit === '10.00',
        'Staff role CANNOT modify restaurant settings (Blocked by RLS)');

    // Staff cannot create a new reward
    await setAuthContext(U_STAFF1);
    let staffInsertRewardFailed = false;
    try {
        await db.query(`
            INSERT INTO rewards (restaurant_id, title, cost_points_stamps)
            VALUES ('${R1_ID}', 'Unauthorized Staff Reward', 10);
        `);
    } catch {
        staffInsertRewardFailed = true;
    }
    assert(staffInsertRewardFailed, 'Staff role CANNOT insert rewards (Blocked by RLS)');

    // Staff cannot view audit logs
    const staffAuditLogs = await db.query(`SELECT * FROM audit_logs WHERE restaurant_id = '${R1_ID}';`);
    assert(staffAuditLogs.rows.length === 0, 'Staff role CANNOT view audit logs (Restricted to Manager/Owner)');

    // Context: Manager 1 (Marcus Chen)
    await setAuthContext(U_MGR1);

    // Manager CAN create rewards
    await db.query(`
        INSERT INTO rewards (restaurant_id, title, cost_points_stamps)
        VALUES ('${R1_ID}', 'Manager Special Cold Brew', 60);
    `);
    const checkRewardCreated = await db.query<{ title: string }>(`
        SELECT title FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Manager Special Cold Brew';
    `);
    assert(checkRewardCreated.rows.length === 1, 'Manager role CAN create rewards (Allowed by RLS)');

    // Manager CANNOT invite/create staff (Only Owner can)
    let managerStaffInviteFailed = false;
    try {
        await db.query(`
            INSERT INTO restaurant_staff (restaurant_id, user_id, email, full_name, role)
            VALUES ('${R1_ID}', gen_random_uuid(), 'newstaff@artisancoffee.com', 'Unauthorized Add', 'STAFF');
        `);
    } catch {
        managerStaffInviteFailed = true;
    }
    assert(managerStaffInviteFailed, 'Manager role CANNOT invite/manage staff (Owner only)');

    // Context: Owner 1 (Eleanor Vance)
    await setAuthContext(U_OWNER1);

    // Owner CAN invite staff
    const newStaffUserId = 'd1111111-1111-1111-1111-111111111111';
    await db.query(`
        INSERT INTO restaurant_staff (restaurant_id, user_id, email, full_name, role)
        VALUES ('${R1_ID}', '${newStaffUserId}', 'juniorbarista@artisancoffee.com', 'Junior Barista', 'STAFF');
    `);
    const checkStaffCreated = await db.query(`
        SELECT id FROM restaurant_staff WHERE restaurant_id = '${R1_ID}' AND email = 'juniorbarista@artisancoffee.com';
    `);
    assert(checkStaffCreated.rows.length === 1, 'Owner role CAN invite and manage staff (Allowed by RLS)');

    // ------------------------------------------------------------------------
    // TEST SUITE 5: Loyalty Ledger & Atomic Redemption Engine
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 5: Loyalty Ledger & Atomic Redemption ---${RESET}`);

    // Context: Customer A (Alice)
    await setAuthContext(U_CUST_A);

    await resetToSuperuser();
    const custAId = (await db.query<{ id: string }>(`SELECT id FROM customers WHERE user_id = '${U_CUST_A}';`)).rows[0].id;
    const rewardPastryId = (await db.query<{ id: string }>(`
        SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Fresh Baked Croissant or Scone';
    `)).rows[0].id;

    await setAuthContext(U_CUST_A);

    // Issue reward redemption (cost: 75 points, current balance: 120 -> new balance: 45)
    const idempotencyKey = 'IDEM-TEST-KEY-001';
    const issueRes = await db.query<{ fn_issue_reward_redemption: any }>(`
        SELECT fn_issue_reward_redemption(
            '${R1_ID}'::uuid,
            '${custAId}'::uuid,
            '${rewardPastryId}'::uuid,
            '${idempotencyKey}',
            15
        );
    `);

    const issuedPayload = issueRes.rows[0].fn_issue_reward_redemption;
    assert(issuedPayload.status === 'ISSUED', 'fn_issue_reward_redemption: Issued redemption successfully');
    assert(issuedPayload.remaining_balance === 45, 'fn_issue_reward_redemption: Deducted 75 points (120 - 75 = 45)');
    assert(typeof issuedPayload.code === 'string' && issuedPayload.code.startsWith('RD-'), 
        'fn_issue_reward_redemption: Generated single-use code formatted RD-XXXX-XXXX');

    // Test Idempotency: Calling with identical idempotency_key returns existing code without double debit!
    const replayRes = await db.query<{ fn_issue_reward_redemption: any }>(`
        SELECT fn_issue_reward_redemption(
            '${R1_ID}'::uuid,
            '${custAId}'::uuid,
            '${rewardPastryId}'::uuid,
            '${idempotencyKey}',
            15
        );
    `);
    const replayPayload = replayRes.rows[0].fn_issue_reward_redemption;
    assert(replayPayload.code === issuedPayload.code && replayPayload.is_idempotent_replay === true,
        'Idempotency: Repeated redemption with same key returns identical code without double debit');

    // Verify balance was NOT deducted a second time
    const balanceCheck = await db.query<{ current_balance: number }>(`
        SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = '${R1_ID}' AND customer_id = '${custAId}';
    `);
    assert(balanceCheck.rows[0].current_balance === 45, 
        'Idempotency: Balance remains exactly 45 after replay request');

    // Test In-Store Staff Fulfillment
    await setAuthContext(U_STAFF1);

    const fulfillRes = await db.query<{ fn_fulfill_reward_redemption: any }>(`
        SELECT fn_fulfill_reward_redemption(
            '${R1_ID}'::uuid,
            '${issuedPayload.code}',
            '${U_STAFF1}'::uuid,
            'Verified at counter register'
        );
    `);
    const fulfillPayload = fulfillRes.rows[0].fn_fulfill_reward_redemption;
    assert(fulfillPayload.status === 'REDEEMED', 
        'fn_fulfill_reward_redemption: Staff verified and marked code as REDEEMED');

    // Double Redemption Prevention: Fulfilling the exact same code again must fail immediately!
    let doubleFulfillFailed = false;
    let doubleFulfillError = '';
    try {
        await db.query(`
            SELECT fn_fulfill_reward_redemption(
                '${R1_ID}'::uuid,
                '${issuedPayload.code}',
                '${U_STAFF1}'::uuid
            );
        `);
    } catch (err: any) {
        doubleFulfillFailed = true;
        doubleFulfillError = err.message;
    }
    assert(doubleFulfillFailed && doubleFulfillError.includes('already been redeemed'),
        'Double-Redemption Protection: Code cannot be redeemed twice');

    // Insufficient Balance Prevention: Attempting to redeem 200 points with balance 45 fails!
    const rewardBeansId = (await resetToSuperuser().then(() => db.query<{ id: string }>(`
        SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Single-Origin Coffee Beans (250g)';
    `))).rows[0].id;

    await setAuthContext(U_CUST_A);
    let insufficientBalanceFailed = false;
    let insufficientBalanceError = '';
    try {
        await db.query(`
            SELECT fn_issue_reward_redemption(
                '${R1_ID}'::uuid,
                '${custAId}'::uuid,
                '${rewardBeansId}'::uuid,
                'IDEM-FAIL-BALANCE-KEY'
            );
        `);
    } catch (err: any) {
        insufficientBalanceFailed = true;
        insufficientBalanceError = err.message;
    }
    assert(insufficientBalanceFailed && insufficientBalanceError.includes('Insufficient balance'),
        'Atomic Engine: Rejects redemption when customer balance is insufficient');

    // Test Customer Visit Recording by Staff (Accrues points and logs in ledger)
    await setAuthContext(U_STAFF1);
    const visitRes = await db.query<{ fn_record_customer_visit: any }>(`
        SELECT fn_record_customer_visit(
            '${R1_ID}'::uuid,
            '${custAId}'::uuid,
            '${U_STAFF1}'::uuid,
            12.50,
            'Table 2 lunch purchase'
        );
    `);
    const visitPayload = visitRes.rows[0].fn_record_customer_visit;
    // $12.50 * 10 points/$ = 125 points + 45 prior = 170
    assert(visitPayload.points_or_stamps_earned === 125, 'fn_record_customer_visit: Earned 125 points ($12.50 * 10)');
    assert(visitPayload.new_balance === 170, 'fn_record_customer_visit: New balance updated to 170 (45 + 125)');

    // ------------------------------------------------------------------------
    // TEST SUITE 6: Security Regression & Stored Procedure Hardening
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 6: Security Regression & Hardening ---${RESET}`);

    // 1. Direct customer injection defense (RLS requires user_id = auth.uid())
    await setAuthContext(U_CUST_A);
    let rogueCustInsertBlocked = false;
    try {
        await db.query(`
            INSERT INTO customers (phone, full_name, user_id)
            VALUES ('+15559990001', 'Rogue Inject', NULL);
        `);
    } catch {
        rogueCustInsertBlocked = true;
    }
    assert(rogueCustInsertBlocked, 'Security: Direct customer insert with NULL user_id blocked by RLS');

    // 2. Impersonation defense in fn_record_customer_visit
    await setAuthContext(U_CUST_A);
    let spoofVisitFailed = false;
    try {
        await db.query(`
            SELECT fn_record_customer_visit(
                '${R1_ID}'::uuid,
                '${custAId}'::uuid,
                '${U_STAFF1}'::uuid,
                500.00
            );
        `);
    } catch (err: any) {
        spoofVisitFailed = err.message.includes('impersonate');
    }
    assert(spoofVisitFailed, 'Security: Customer spoofing staff ID in fn_record_customer_visit is rejected');

    // 3. Cross-customer reward redemption defense in fn_issue_reward_redemption
    // Customer B attempts to spend Customer A's points
    await setAuthContext(U_CUST_B);
    let crossRedeemFailed = false;
    try {
        await db.query(`
            SELECT fn_issue_reward_redemption(
                '${R1_ID}'::uuid,
                '${custAId}'::uuid,
                '${rewardPastryId}'::uuid
            );
        `);
    } catch (err: any) {
        crossRedeemFailed = err.message.includes('Unauthorized') || err.message.includes('another customer');
    }
    assert(crossRedeemFailed, 'Security: Customer B cannot redeem Customer A rewards via stored procedure');

    // 4. Staff cannot perform manager/owner balance adjustments
    await setAuthContext(U_STAFF1);
    let staffAdjustFailed = false;
    try {
        await db.query(`
            SELECT fn_adjust_customer_balance(
                '${R1_ID}'::uuid,
                '${custAId}'::uuid,
                '${U_STAFF1}'::uuid,
                50,
                'Staff trying to add points'
            );
        `);
    } catch (err: any) {
        staffAdjustFailed = err.message.includes('Only Manager or Owner');
    }
    assert(staffAdjustFailed, 'Security: Regular staff role CANNOT execute fn_adjust_customer_balance');

    // 5. Manager can perform atomic adjustment and ledger is updated
    await setAuthContext(U_MGR1);
    const mgrAdjustRes = await db.query<{ fn_adjust_customer_balance: any }>(`
        SELECT fn_adjust_customer_balance(
            '${R1_ID}'::uuid,
            '${custAId}'::uuid,
            '${U_MGR1}'::uuid,
            30,
            'Manager courtesy credit'
        );
    `);
    const adjustPayload = mgrAdjustRes.rows[0].fn_adjust_customer_balance;
    // Previous balance was 170 + 30 = 200
    assert(adjustPayload.current_balance === 200, 'Security: Manager atomic balance adjustment succeeded (170 + 30 = 200)');

    // 6. Verify ledger transaction recorded for adjustment
    const adjustLedgerRes = await db.query<{ count: string }>(`
        SELECT COUNT(*)::text as count
        FROM loyalty_transactions
        WHERE restaurant_id = '${R1_ID}'
          AND customer_id = '${custAId}'
          AND type = 'MANUAL_ADJUSTMENT';
    `);
    assert(adjustLedgerRes.rows[0].count === '1', 'Security: Manual adjustment atomically created ledger transaction');

    // 7. Negative adjustment resulting in negative balance is rejected
    await setAuthContext(U_MGR1);
    let negativeAdjustFailed = false;
    try {
        await db.query(`
            SELECT fn_adjust_customer_balance(
                '${R1_ID}'::uuid,
                '${custAId}'::uuid,
                '${U_MGR1}'::uuid,
                -9999,
                'Excessive deduction'
            );
        `);
    } catch (err: any) {
        negativeAdjustFailed = err.message.includes('negative balance');
    }
    assert(negativeAdjustFailed, 'Security: Manual adjustment resulting in negative balance rejected');

    // ------------------------------------------------------------------------
    // TEST SUITE 7: S A Dosa Cafe Pilot & Stamp Claim System
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}--- TEST SUITE 7: S A Dosa Cafe Pilot & Stamp Claim System ---${RESET}`);

    const SADC_ID = '33333333-3333-3333-3333-333333333333';
    const U_SADC_CASHIER = 'c3333333-2222-2222-2222-222222222222';
    const U_SADC_CUST1 = 'd1111111-1111-1111-1111-111111111111'; // Pradyumna (3 stamps)
    const U_SADC_CUST2 = 'd2222222-2222-2222-2222-222222222222'; // Ananya (6 stamps)

    // 1. Verify SA Dosa Cafe tenant setup
    const sadcRes = await db.query<{ slug: string; loyalty_model: string; stamps_target_count: number; instagram_url: string }>(`
        SELECT r.slug, s.loyalty_model, s.stamps_target_count, s.instagram_url
        FROM restaurants r
        JOIN restaurant_settings s ON s.restaurant_id = r.id
        WHERE r.id = '${SADC_ID}';
    `);
    assert(
        sadcRes.rows[0].slug === 'sa-dosa-cafe' &&
        sadcRes.rows[0].loyalty_model === 'STAMPS' &&
        sadcRes.rows[0].stamps_target_count === 7 &&
        sadcRes.rows[0].instagram_url.includes('sa_dosacafe'),
        'S A Dosa Cafe tenant configured with STAMPS model, 7 target stamps, and social links'
    );

    // 2. Customer Pradyumna requests claim code
    await setAuthContext(U_SADC_CUST1);
    const claimRes1 = await db.query<{ result: any }>(`
        SELECT fn_create_stamp_claim('${SADC_ID}'::uuid, '${U_SADC_CUST1}'::uuid, 10) as result;
    `);
    const claimCode1 = claimRes1.rows[0].result.code;
    assert(
        claimCode1 && claimCode1.length === 6 && claimRes1.rows[0].result.status === 'CREATED',
        'Customer generates secure 6-digit stamp claim code'
    );

    // 3. Repeated claim code request returns existing active code (prevents spamming)
    const claimRes2 = await db.query<{ result: any }>(`
        SELECT fn_create_stamp_claim('${SADC_ID}'::uuid, '${U_SADC_CUST1}'::uuid, 10) as result;
    `);
    assert(
        claimRes2.rows[0].result.code === claimCode1 && claimRes2.rows[0].result.is_existing === true,
        'Repeated claim request returns existing active code without duplicating'
    );

    // 4. Cashier verifies claim code
    await setAuthContext(U_SADC_CASHIER);
    const verifyRes = await db.query<{ result: any }>(`
        SELECT fn_verify_stamp_claim('${SADC_ID}'::uuid, '${claimCode1}', '${U_SADC_CASHIER}'::uuid) as result;
    `);
    assert(
        verifyRes.rows[0].result.customer_name === 'Pradyumna Joshi' &&
        verifyRes.rows[0].result.current_stamps === 3 &&
        verifyRes.rows[0].result.target_stamps === 7,
        'Cashier verifies claim code: accurately displays customer name and 3 / 7 stamps'
    );

    // 5. Cashier consumes claim code to award +1 stamp
    const consumeRes = await db.query<{ result: any }>(`
        SELECT fn_consume_stamp_claim('${SADC_ID}'::uuid, '${claimCode1}', '${U_SADC_CASHIER}'::uuid, 'Cashier dine-in checkout') as result;
    `);
    assert(
        consumeRes.rows[0].result.success === true &&
        consumeRes.rows[0].result.previous_stamps === 3 &&
        consumeRes.rows[0].result.new_stamps === 4 &&
        consumeRes.rows[0].result.reward_unlocked === false,
        'Cashier consumes code: stamp balance increments from 3 to 4 / 7'
    );

    // 6. Replay defense: second attempt to consume same code fails
    let replayFailed = false;
    try {
        await db.query(`
            SELECT fn_consume_stamp_claim('${SADC_ID}'::uuid, '${claimCode1}', '${U_SADC_CASHIER}'::uuid) as result;
        `);
    } catch (err: any) {
        replayFailed = err.message.includes('already been used');
    }
    assert(replayFailed, 'Replay Defense: Consumed claim code cannot be reused');

    // 7. 7th Stamp Unlocks Celebration Reward
    await setAuthContext(U_SADC_CUST2); // Ananya (has 6 stamps)
    const claimResCust2 = await db.query<{ result: any }>(`
        SELECT fn_create_stamp_claim('${SADC_ID}'::uuid, '${U_SADC_CUST2}'::uuid, 10) as result;
    `);
    const codeCust2 = claimResCust2.rows[0].result.code;

    await setAuthContext(U_SADC_CASHIER);
    const unlockRes = await db.query<{ result: any }>(`
        SELECT fn_consume_stamp_claim('${SADC_ID}'::uuid, '${codeCust2}', '${U_SADC_CASHIER}'::uuid, '7th visit completed') as result;
    `);
    assert(
        unlockRes.rows[0].result.new_stamps === 7 &&
        unlockRes.rows[0].result.reward_unlocked === true,
        'Seventh Stamp Milestone: 7 / 7 stamps reached, triggering reward celebration unlock'
    );
    console.log(`\n${BOLD}${CYAN}======================================================${RESET}`);
    console.log(`${BOLD}TEST RUN COMPLETE:${RESET} Total: ${totalTests} | Passed: ${GREEN}${passedTests}${RESET} | Failed: ${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);
    console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error(`\n${RED}Fatal error running test suite:${RESET}`, err);
    process.exit(1);
});
