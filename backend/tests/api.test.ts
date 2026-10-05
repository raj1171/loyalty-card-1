// ============================================================================
// File: backend/tests/api.test.ts
// Description: Comprehensive automated test suite for Cloudflare Workers API
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../src/index.js';
import { setTestDatabaseClient, getServiceSupabaseClient } from '../src/services/supabase.js';

describe('Cloudflare Workers REST API Integration Tests', () => {
  let db: PGlite;

  // Test UUIDs from 00001_demo_seed.sql
  const R1_ID = '11111111-1111-1111-1111-111111111111'; // Artisan Coffee (POINTS)
  const R2_ID = '22222222-2222-2222-2222-222222222222'; // Urban Bites (STAMPS)

  const U_OWNER1 = 'a1111111-1111-1111-1111-111111111111';
  const U_MGR1 = 'a2222222-2222-2222-2222-222222222222';
  const U_STAFF1 = 'a3333333-3333-3333-3333-333333333333';
  const U_OWNER2 = 'b1111111-1111-1111-1111-111111111111';
  const U_STAFF2 = 'b2222222-2222-2222-2222-222222222222';

  const U_CUST_A = 'c1111111-1111-1111-1111-111111111111'; // Alice Walker (120 points)
  const U_CUST_B = 'c2222222-2222-2222-2222-222222222222'; // Bob Martinez (45 points)

  const env = {
    ENVIRONMENT: 'test',
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  };

  beforeAll(async () => {
    db = new PGlite();

    const rootDir = path.resolve('..');
    const m1 = fs.readFileSync(path.join(rootDir, 'database/migrations/00001_initial_schema.sql'), 'utf-8');
    const m2 = fs.readFileSync(path.join(rootDir, 'database/migrations/00002_functions_and_triggers.sql'), 'utf-8');
    const m3 = fs.readFileSync(path.join(rootDir, 'database/migrations/00003_rls_policies.sql'), 'utf-8');
    const m4 = fs.readFileSync(path.join(rootDir, 'database/migrations/00004_sa_dosa_cafe_and_stamp_claims.sql'), 'utf-8');
    const s1 = fs.readFileSync(path.join(rootDir, 'database/seeds/00001_demo_seed.sql'), 'utf-8');

    await db.exec(m1);
    await db.exec(m2);
    await db.exec(m3);
    await db.exec(m4);
    await db.exec(s1);

    setTestDatabaseClient(db);
  });

  // Helper to make mock requests to Hono app
  const makeRequest = async (
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ): Promise<{ status: number; headers: Headers; json: () => Promise<any> }> => {
    const { method = 'GET', headers = {}, body } = options;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const reqInit: RequestInit = {
      method,
      headers: reqHeaders,
    };

    if (body !== undefined) {
      reqInit.body = JSON.stringify(body);
    }

    const res = await app.request(`http://localhost${path}`, reqInit, env as any);
    return {
      status: res.status,
      headers: res.headers,
      json: () => res.json() as Promise<any>,
    };
  };

  // --------------------------------------------------------------------------
  // 1. HEALTH & SYSTEM CHECK
  // --------------------------------------------------------------------------
  describe('System & Health Checks', () => {
    it('returns system health status and timestamp', async () => {
      const res = await makeRequest('/api/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('loyalty-backend');
    });

    it('sets standard security headers on all responses', async () => {
      const res = await makeRequest('/api/health');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
    });
  });

  // --------------------------------------------------------------------------
  // 2. AUTHENTICATION & SESSION HANDLING
  // --------------------------------------------------------------------------
  describe('Authentication & Session Handling', () => {
    it('POST /api/auth/otp/send - sends OTP successfully for valid phone', async () => {
      const res = await makeRequest('/api/auth/otp/send', {
        method: 'POST',
        body: { phone: '+15551000001' },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.phone).toBe('+15551000001');
    });

    it('POST /api/auth/otp/send - rejects invalid phone format', async () => {
      const res = await makeRequest('/api/auth/otp/send', {
        method: 'POST',
        body: { phone: 'not-a-number' },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/otp/verify - verifies correct OTP and returns session token', async () => {
      const res = await makeRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: {
          phone: '+15551000001',
          code: '123456',
          restaurant_id: R1_ID,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.session_token).toBeDefined();
      expect(json.data.user_id).toBe(U_CUST_A);
    });

    it('POST /api/auth/otp/verify - rejects incorrect OTP code', async () => {
      const res = await makeRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: {
          phone: '+15551000001',
          code: '000000',
        },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_OTP');
    });

    it('GET /api/me - rejects request when Bearer token is missing', async () => {
      const res = await makeRequest('/api/me');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/me - returns customer profile when authenticated', async () => {
      const res = await makeRequest('/api/me', {
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.phone).toBe('+15551000001');
      expect(json.data.full_name).toBe('Alice Walker');
    });
  });

  // --------------------------------------------------------------------------
  // 3. RESTAURANT RESOLUTION & TENANT ISOLATION
  // --------------------------------------------------------------------------
  describe('Restaurant Resolution & Tenant Isolation', () => {
    it('GET /api/r/:slug - resolves active restaurant branding and settings', async () => {
      const res = await makeRequest('/api/r/artisan-coffee');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant.slug).toBe('artisan-coffee');
      expect(json.data.restaurant.name).toBe('The Artisan Coffee Roasters');
      expect(json.data.settings.loyalty_model).toBe('POINTS');
      expect(json.data.sample_rewards.length).toBeGreaterThan(0);
    });

    it('GET /api/r/:slug - returns 404 for non-existent restaurant slug', async () => {
      const res = await makeRequest('/api/r/non-existent-cafe');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('Tenant Isolation: Staff of Restaurant A CANNOT access Restaurant B data', async () => {
      // Staff 1 belongs to Restaurant 1 (R1_ID). Attempt to access Restaurant 2 (R2_ID) settings:
      const res = await makeRequest(`/api/admin/settings?restaurant_id=${R2_ID}`, {
        headers: { Authorization: `Bearer ${U_STAFF1}` },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('Tenant mismatch');
    });

    it('Tenant Isolation: Staff of Restaurant A CANNOT fulfill redemptions for Restaurant B', async () => {
      // Attempting to verify or fulfill code under foreign restaurant returns 403
      const res = await makeRequest(`/api/staff/redemptions/fulfill?restaurant_id=${R2_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { code: 'RD-TEST-9999' },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('Tenant mismatch');
    });
  });

  // --------------------------------------------------------------------------
  // 4. ROLE-BASED ACCESS CONTROL & ROLE ESCALATION PREVENTIONS
  // --------------------------------------------------------------------------
  describe('Role-Based Access Control & Privilege Escalation Defenses', () => {
    it('Customer CANNOT access staff endpoints', async () => {
      const res = await makeRequest(`/api/staff/redemptions/verify?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
        body: { code: 'RD-ART1-7788' },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('Required role: STAFF or MANAGER or OWNER');
    });

    it('Customer CANNOT access admin endpoints', async () => {
      const res = await makeRequest(`/api/admin/settings?restaurant_id=${R1_ID}`, {
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(403);
    });

    it('Staff role CANNOT create rewards (Requires MANAGER or OWNER)', async () => {
      const res = await makeRequest('/api/admin/rewards', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: {
          title: 'Unauthorized Staff Reward',
          cost_points_stamps: 50,
        },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('Required role: MANAGER or OWNER');
    });

    it('Staff role CANNOT update restaurant settings', async () => {
      const res = await makeRequest('/api/admin/settings', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { points_per_currency_unit: 99 },
      });
      expect(res.status).toBe(403);
    });

    it('Manager role CANNOT invite/manage staff (Requires OWNER)', async () => {
      const res = await makeRequest('/api/admin/staff/invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_MGR1}` },
        body: {
          user_id: 'e1111111-1111-1111-1111-111111111111',
          email: 'unauthorized@artisancoffee.com',
          full_name: 'Test Staff',
          role: 'STAFF',
        },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('Required role: OWNER');
    });

    it('Owner role CAN invite staff and manage restaurant', async () => {
      const newStaffId = 'e2222222-2222-2222-2222-222222222222';
      const res = await makeRequest('/api/admin/staff/invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_OWNER1}` },
        body: {
          user_id: newStaffId,
          email: 'newhire@artisancoffee.com',
          full_name: 'New Barista',
          role: 'STAFF',
        },
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe('newhire@artisancoffee.com');
    });
  });

  // --------------------------------------------------------------------------
  // 5. SERVER-SIDE LOYALTY CALCULATIONS & BALANCE INTEGRITY
  // --------------------------------------------------------------------------
  describe('Server-Side Loyalty Calculations & Balance Tracking', () => {
    it('Records customer visit and computes points strictly server-side', async () => {
      // In Restaurant 1, rate is 10 points per $1. Spend = $15.50 -> 155 points.
      // Even if a malicious frontend sends a fake points parameter, it is completely ignored!
      const res = await makeRequest('/api/staff/visits/record', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: {
          customer_phone: '+15551000002', // Customer B (Bob Martinez)
          spend_amount: 15.50,
          notes: 'Dine-in pastry order',
          points: 99999, // Fake frontend points value must be ignored!
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.points_or_stamps_earned).toBe(155); // 15.50 * 10
      expect(json.data.new_balance).toBe(200); // 45 initial + 155 = 200
    });

    it('GET /api/me/dashboard - provides consolidated mobile payload', async () => {
      const res = await makeRequest(`/api/me/dashboard?restaurant_id=${R1_ID}`, {
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.membership.membership_number).toBe('M-ART1-0001');
      expect(json.data.loyalty_account.current_balance).toBe(120);
      expect(json.data.recent_transactions.length).toBeGreaterThan(0);
      expect(json.data.active_redemptions.length).toBeGreaterThan(0);
      expect(json.data.available_rewards.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. ATOMIC REWARD REDEMPTION, IDEMPOTENCY & REPLAY DEFENSES
  // --------------------------------------------------------------------------
  describe('Atomic Reward Redemption, Idempotency & Replay Defenses', () => {
    let rewardId: string;
    let issuedCode: string;

    it('Customer A redeems eligible reward (Free Specialty Latte: 50 pts, balance: 120 -> 70)', async () => {
      // Find reward ID
      const rRes = await db.query<{ id: string }>(
        `SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Free Specialty Latte';`
      );
      rewardId = rRes.rows[0].id;

      const idempotencyKey = 'TEST-IDEMPOTENT-KEY-ALPHA';
      const res = await makeRequest(`/api/rewards/${rewardId}/redeem?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${U_CUST_A}`,
          'Idempotency-Key': idempotencyKey,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ISSUED');
      expect(json.data.remaining_balance).toBe(70); // 120 - 50 = 70
      expect(json.data.code).toMatch(/^RD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      issuedCode = json.data.code;
    });

    it('Idempotency: Repeated request with identical Idempotency-Key returns existing code without double debit', async () => {
      const idempotencyKey = 'TEST-IDEMPOTENT-KEY-ALPHA';
      const res = await makeRequest(`/api/rewards/${rewardId}/redeem?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${U_CUST_A}`,
          'Idempotency-Key': idempotencyKey,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toBe(issuedCode);
      expect(json.data.is_idempotent_replay).toBe(true);

      // Verify balance in DB remains exactly 70
      const accRes = await db.query<{ current_balance: number }>(
        `SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = '${R1_ID}' AND customer_id = (SELECT id FROM customers WHERE user_id = '${U_CUST_A}');`
      );
      expect(accRes.rows[0].current_balance).toBe(70);
    });

    it('Staff verifies issued redemption code before fulfillment', async () => {
      const res = await makeRequest('/api/staff/redemptions/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { code: issuedCode },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.is_valid).toBe(true);
      expect(json.data.reward_title).toBe('Free Specialty Latte');
      expect(json.data.customer_name).toBe('Alice Walker');
    });

    it('Staff fulfills code: state transitions to REDEEMED', async () => {
      const res = await makeRequest('/api/staff/redemptions/fulfill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { code: issuedCode, notes: 'Served large oat latte' },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('REDEEMED');
    });

    it('Double Redemption: Attempting to redeem the same code a second time FAILS (409 Conflict)', async () => {
      const res = await makeRequest('/api/staff/redemptions/fulfill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { code: issuedCode },
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ALREADY_REDEEMED');
      expect(json.error.message).toContain('already been redeemed');
    });

    it('Insufficient Balance: Attempting to redeem when points are insufficient FAILS (409 Conflict)', async () => {
      // Reward costs 200 points, but Customer A only has 70 points remaining!
      const beansRewardId = (await db.query<{ id: string }>(
        `SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Single-Origin Coffee Beans (250g)';`
      )).rows[0].id;

      const res = await makeRequest(`/api/rewards/${beansRewardId}/redeem?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_BALANCE');
      expect(json.error.message).toContain('Insufficient balance');
    });

    it('Invalid Reward: Attempting to redeem an inactive or non-existent reward returns error', async () => {
      const fakeRewardId = '99999999-9999-9999-9999-999999999999';
      const res = await makeRequest(`/api/rewards/${fakeRewardId}/redeem?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('Expired Reward: Attempting to redeem past valid_until date fails', async () => {
      // Create an expired reward
      const expRes = await db.query<{ id: string }>(
        `INSERT INTO rewards (
          restaurant_id, title, cost_points_stamps, valid_from, valid_until
        ) VALUES (
          '${R1_ID}', 'Expired Summer Special', 20, NOW() - interval '30 days', NOW() - interval '1 day'
        ) RETURNING id;`
      );
      const expiredRewardId = expRes.rows[0].id;

      const res = await makeRequest(`/api/rewards/${expiredRewardId}/redeem?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('expired');
    });
  });

  // --------------------------------------------------------------------------
  // 7. ADMIN MANAGEMENT & AUDIT LOGS
  // --------------------------------------------------------------------------
  describe('Admin Operations & Security Audit Logging', () => {
    it('Admin can list customers with balance and membership info', async () => {
      const res = await makeRequest('/api/admin/customers', {
        headers: { Authorization: `Bearer ${U_STAFF1}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.customers.length).toBeGreaterThan(0);
    });

    it('Admin can view real-time aggregated analytics', async () => {
      const res = await makeRequest('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${U_MGR1}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.total_members).toBeGreaterThan(0);
      expect(json.data.points_issued).toBeGreaterThan(0);
      expect(json.data.points_redeemed).toBeGreaterThan(0);
    });

    it('Audit Log captures sensitive operations in database', async () => {
      const auditRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM audit_logs WHERE restaurant_id = '${R1_ID}';`
      );
      expect(parseInt(auditRes.rows[0].count, 10)).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 8. SECURITY HARDENING & REGRESSION SUITE
  // --------------------------------------------------------------------------
  describe('Security Hardening & Vulnerability Regression Suite', () => {
    it('FATAL: getServiceSupabaseClient throws error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      expect(() => {
        getServiceSupabaseClient({
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key-only',
        } as any);
      }).toThrow('SUPABASE_SERVICE_ROLE_KEY is required for server database operations.');
    });

    it('Tenant Middleware: supports X-Restaurant-Id header and rejects malformed UUID with 400', async () => {
      // 1. Valid X-Restaurant-Id header works
      const validRes = await makeRequest('/api/admin/settings', {
        headers: {
          Authorization: `Bearer ${U_STAFF1}`,
          'X-Restaurant-Id': R1_ID,
        },
      });
      expect(validRes.status).toBe(200);

      // 2. Malformed X-Restaurant-Id header is rejected immediately with 400
      const invalidRes = await makeRequest('/api/admin/settings', {
        headers: {
          Authorization: `Bearer ${U_STAFF1}`,
          'X-Restaurant-Id': 'not-a-uuid-format',
        },
      });
      expect(invalidRes.status).toBe(400);
      const invalidJson = await invalidRes.json();
      expect(invalidJson.error.message).toContain('Invalid restaurant_id UUID format');
    });

    it('Customer Isolation: Customer A cannot access Customer B data', async () => {
      // Customer A requesting /api/me only sees their own phone and identity
      const resA = await makeRequest('/api/me', {
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(resA.status).toBe(200);
      const jsonA = await resA.json();
      expect(jsonA.data.user_id).toBe(U_CUST_A);
      expect(jsonA.data.phone).toBe('+15551000001');

      // Customer B requesting /api/me only sees their own identity
      const resB = await makeRequest('/api/me', {
        headers: { Authorization: `Bearer ${U_CUST_B}` },
      });
      expect(resB.status).toBe(200);
      const jsonB = await resB.json();
      expect(jsonB.data.user_id).toBe(U_CUST_B);
      expect(jsonB.data.phone).toBe('+15551000002');
      expect(jsonB.data.user_id).not.toBe(jsonA.data.user_id);
    });

    it('Customers cannot modify reward redemption status (requires staff role)', async () => {
      const res = await makeRequest(`/api/staff/redemptions/fulfill?restaurant_id=${R1_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
        body: { code: 'RD-FAKE-1234' },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('Customers cannot call admin operations', async () => {
      const res = await makeRequest(`/api/admin/customers?restaurant_id=${R1_ID}`, {
        headers: { Authorization: `Bearer ${U_CUST_A}` },
      });
      expect(res.status).toBe(403);
    });

    it('Staff cannot perform owner-only operations (PATCH /restaurant, POST /staff/invite)', async () => {
      // 1. Staff cannot update restaurant details
      const patchRes = await makeRequest('/api/admin/restaurant', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { tagline: 'Hacked by staff' },
      });
      expect(patchRes.status).toBe(403);
      const patchJson = await patchRes.json();
      expect(patchJson.error.message).toContain('Required role: OWNER');

      // 2. Staff cannot invite other staff
      const inviteRes = await makeRequest('/api/admin/staff/invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: {
          user_id: 'e3333333-3333-3333-3333-333333333333',
          email: 'barista2@artisancoffee.com',
          full_name: 'Barista Two',
          role: 'STAFF',
        },
      });
      expect(inviteRes.status).toBe(403);
    });

    it('Staff cannot perform balance adjustments without MANAGER or OWNER role', async () => {
      const custRes = await db.query<{ id: string }>(
        `SELECT id FROM customers WHERE user_id = '${U_CUST_B}';`
      );
      const customerId = custRes.rows[0].id;

      const res = await makeRequest(`/api/admin/customers/${customerId}/adjust`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: { points_stamps: 100, reason: 'Staff unauthorized bonus' },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('Required role: MANAGER or OWNER');
    });

    it('Manager can adjust customer balance atomically via fn_adjust_customer_balance', async () => {
      const custRes = await db.query<{ id: string }>(
        `SELECT id FROM customers WHERE user_id = '${U_CUST_B}';`
      );
      const customerId = custRes.rows[0].id;

      const preBalanceRes = await db.query<{ current_balance: number }>(
        `SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = '${R1_ID}' AND customer_id = '${customerId}';`
      );
      const preBalance = preBalanceRes.rows[0].current_balance;

      const res = await makeRequest(`/api/admin/customers/${customerId}/adjust`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_MGR1}` },
        body: { points_stamps: 25, reason: 'Goodwill compensation for delay' },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.current_balance).toBe(preBalance + 25);

      // Verify immutable audit ledger entry was written
      const txRes = await db.query<{ type: string; points_stamps: number; description: string }>(
        `SELECT type, points_stamps, description 
         FROM loyalty_transactions 
         WHERE restaurant_id = '${R1_ID}' AND customer_id = '${customerId}'
         ORDER BY created_at DESC LIMIT 1;`
      );
      expect(txRes.rows[0].type).toBe('MANUAL_ADJUSTMENT');
      expect(txRes.rows[0].points_stamps).toBe(25);
      expect(txRes.rows[0].description).toBe('Goodwill compensation for delay');
    });

    it('Manual balance adjustment rejects negative resulting balance', async () => {
      const custRes = await db.query<{ id: string }>(
        `SELECT id FROM customers WHERE user_id = '${U_CUST_B}';`
      );
      const customerId = custRes.rows[0].id;

      const res = await makeRequest(`/api/admin/customers/${customerId}/adjust`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_MGR1}` },
        body: { points_stamps: -99999, reason: 'Excessive debit' },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INSUFFICIENT_BALANCE');
      expect(json.error.message).toContain('negative balance');
    });

    it('PATCH endpoints reject empty payloads with 400 INVALID_PAYLOAD', async () => {
      // 1. PATCH /api/admin/settings
      const setRes = await makeRequest('/api/admin/settings', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_MGR1}` },
        body: {},
      });
      expect(setRes.status).toBe(400);
      const setJson = await setRes.json();
      expect(setJson.error.code).toBe('INVALID_PAYLOAD');

      // 2. PATCH /api/admin/restaurant
      const restRes = await makeRequest('/api/admin/restaurant', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_OWNER1}` },
        body: {},
      });
      expect(restRes.status).toBe(400);
      const restJson = await restRes.json();
      expect(restJson.error.code).toBe('INVALID_PAYLOAD');

      // 3. PATCH /api/admin/rewards/:id
      const rewRes = await db.query<{ id: string }>(
        `SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' LIMIT 1;`
      );
      const patchRewRes = await makeRequest(`/api/admin/rewards/${rewRes.rows[0].id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_MGR1}` },
        body: {},
      });
      expect(patchRewRes.status).toBe(400);
      const patchRewJson = await patchRewRes.json();
      expect(patchRewJson.error.code).toBe('INVALID_PAYLOAD');

      // 4. PATCH /api/me
      const meRes = await makeRequest('/api/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${U_CUST_A}` },
        body: {},
      });
      expect(meRes.status).toBe(400);
      const meJson = await meRes.json();
      expect(meJson.error.code).toBe('INVALID_PAYLOAD');
    });

    it('Staff visit recording caps spend_amount at 50,000 max', async () => {
      const res = await makeRequest('/api/staff/visits/record', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: {
          customer_phone: '+15551000001',
          spend_amount: 999999, // Unreasonable spend amount
        },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Staff visit recording successfully resolves customer via membership_number', async () => {
      // Alice Walker membership number in R1 is 'M-ART1-0001'
      const preBalanceRes = await db.query<{ current_balance: number }>(
        `SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = '${R1_ID}' AND customer_id = (SELECT id FROM customers WHERE user_id = '${U_CUST_A}');`
      );
      const preBalance = preBalanceRes.rows[0].current_balance;

      const res = await makeRequest('/api/staff/visits/record', {
        method: 'POST',
        headers: { Authorization: `Bearer ${U_STAFF1}` },
        body: {
          membership_number: 'M-ART1-0001',
          spend_amount: 10, // 10 * 10 = 100 points
          notes: 'Scanned customer QR code',
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.points_or_stamps_earned).toBe(100);
      expect(json.data.new_balance).toBe(preBalance + 100);
    });

    it('GET /api/restaurants/:id validates UUID and rejects inactive restaurants', async () => {
      // 1. Malformed UUID format is rejected
      const malformedRes = await makeRequest('/api/restaurants/not-a-valid-uuid');
      expect(malformedRes.status).toBe(400);
      const malformedJson = await malformedRes.json();
      expect(malformedJson.error.code).toBe('INVALID_UUID');

      // 2. Inactive restaurant is rejected with 404
      const inactRes = await db.query<{ id: string }>(
        `INSERT INTO restaurants (slug, name, is_active) VALUES ('dormant-cafe', 'Dormant Cafe', FALSE) RETURNING id;`
      );
      const dormantId = inactRes.rows[0].id;

      const res = await makeRequest(`/api/restaurants/${dormantId}`);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toContain('not found or inactive');
    });

    it('Race Conditions: Two simultaneous redemptions cannot both succeed when balance only allows one', async () => {
      // Set Customer B balance to exactly 50 points
      const custRes = await db.query<{ id: string }>(
        `SELECT id FROM customers WHERE user_id = '${U_CUST_B}';`
      );
      const customerBId = custRes.rows[0].id;

      await db.query(
        `UPDATE loyalty_accounts SET current_balance = 50 WHERE restaurant_id = '${R1_ID}' AND customer_id = '${customerBId}';`
      );

      // Reward costs 50 points
      const rRes = await db.query<{ id: string }>(
        `SELECT id FROM rewards WHERE restaurant_id = '${R1_ID}' AND title = 'Free Specialty Latte';`
      );
      const latteRewardId = rRes.rows[0].id;

      // Launch two redemption requests concurrently with distinct idempotency keys
      const [res1, res2] = await Promise.all([
        makeRequest(`/api/rewards/${latteRewardId}/redeem?restaurant_id=${R1_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${U_CUST_B}`,
            'Idempotency-Key': 'RACE-ATTEMPT-ALPHA',
          },
        }),
        makeRequest(`/api/rewards/${latteRewardId}/redeem?restaurant_id=${R1_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${U_CUST_B}`,
            'Idempotency-Key': 'RACE-ATTEMPT-BETA',
          },
        }),
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly ONE request must succeed (200) and ONE must fail with 409
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Final balance must be exactly 0, never negative
      const finalBal = await db.query<{ current_balance: number }>(
        `SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = '${R1_ID}' AND customer_id = '${customerBId}';`
      );
      expect(finalBal.rows[0].current_balance).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 9. S A DOSA CAFE PILOT & STAMP CLAIM CASHIER SUITE
  // --------------------------------------------------------------------------
  describe('S A Dosa Cafe Pilot & Stamp Claim Cashier Flow', () => {
    const SA_RESTAURANT_ID = '33333333-3333-3333-3333-333333333333';
    const SA_CASHIER_USER_ID = 'c3333333-2222-2222-2222-222222222222';
    const SA_CUSTOMER_USER_ID = 'd1111111-1111-1111-1111-111111111111'; // Pradyumna (starts with 3 stamps)

    it('GET /api/r/sa-dosa-cafe - loads brand, 7 stamps target, and social links', async () => {
      const res = await makeRequest('/api/r/sa-dosa-cafe');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant.name).toBe('SA Dosa Cafe');
      expect(json.data.restaurant.brand_color).toBe('#FF6310');
      expect(json.data.settings.loyalty_model).toBe('STAMPS');
      expect(json.data.settings.stamps_target_count).toBe(7);
      expect(json.data.settings.instagram_url).toContain('sa_dosacafe');
    });

    it('POST /api/me/stamp-claim/create - customer creates secure 6-digit claim code', async () => {
      const res = await makeRequest(`/api/me/stamp-claim/create?restaurant_id=${SA_RESTAURANT_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SA_CUSTOMER_USER_ID}` },
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toMatch(/^[0-9]{6}$/);
      expect(['CREATED', 'PENDING']).toContain(json.data.status);
      expect(json.data.claim_id).toBeDefined();
    });

    it('GET /api/me/stamp-claim/active - returns pending unexpired claim code', async () => {
      const res = await makeRequest(`/api/me/stamp-claim/active?restaurant_id=${SA_RESTAURANT_ID}`, {
        headers: { Authorization: `Bearer ${SA_CUSTOMER_USER_ID}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).not.toBeNull();
      expect(json.data.code).toMatch(/^[0-9]{6}$/);
      expect(['CREATED', 'PENDING']).toContain(json.data.status);
    });

    it('POST /api/staff/stamp-claims/verify & consume - cashier awards stamp atomically', async () => {
      // 1. Get the customer's active code
      const activeRes = await makeRequest(`/api/me/stamp-claim/active?restaurant_id=${SA_RESTAURANT_ID}`, {
        headers: { Authorization: `Bearer ${SA_CUSTOMER_USER_ID}` },
      });
      const { code } = (await activeRes.json()).data;

      // 2. Cashier verifies the code
      const verifyRes = await makeRequest(`/api/staff/stamp-claims/verify?restaurant_id=${SA_RESTAURANT_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SA_CASHIER_USER_ID}` },
        body: { code },
      });
      expect(verifyRes.status).toBe(200);
      const verifyJson = await verifyRes.json();
      expect(verifyJson.success).toBe(true);
      expect(verifyJson.data.customer_name).toBe('Pradyumna Joshi');
      expect(verifyJson.data.current_stamps).toBe(3);
      expect(verifyJson.data.target_stamps).toBe(7);

      // 3. Cashier consumes the code and awards stamp
      const consumeRes = await makeRequest(`/api/staff/stamp-claims/consume?restaurant_id=${SA_RESTAURANT_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SA_CASHIER_USER_ID}` },
        body: { code, notes: 'Cashier confirmed order' },
      });
      expect(consumeRes.status).toBe(200);
      const consumeJson = await consumeRes.json();
      expect(consumeJson.success).toBe(true);
      expect(consumeJson.data.previous_stamps).toBe(3);
      expect(consumeJson.data.new_stamps).toBe(4);
      expect(consumeJson.data.target_stamps).toBe(7);

      // 4. Replay attack: re-verifying/re-consuming consumed code must fail
      const replayRes = await makeRequest(`/api/staff/stamp-claims/consume?restaurant_id=${SA_RESTAURANT_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SA_CASHIER_USER_ID}` },
        body: { code },
      });
      expect(replayRes.status).toBe(400);
    });
  });
});
