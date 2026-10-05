// ============================================================================
// File: backend/src/modules/rewards/routes.ts
// Description: Rewards catalog and server-side atomic redemption engine
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse, Env, AuthContextUser, ContextVariables } from '../../types/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireCustomer } from '../../middleware/rbac.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';

export const rewardsRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * GET /api/rewards
 * List active rewards for a restaurant.
 * If customer is logged in, calculates eligibility server-side.
 */
rewardsRouter.get(
  '/',
  authMiddleware(false),
  tenantMiddleware(false),
  async (c) => {
    const restaurantId = c.get('restaurantId') as string;
    const auth = c.get('auth') as AuthContextUser | undefined;
    const testDb = getTestDatabaseClient();

    let currentBalance = 0;
    let customerId = auth?.customerId;

    if (testDb) {
      if (auth && auth.role === 'CUSTOMER') {
        if (!customerId) {
          const cRes = await testDb.query(`SELECT id FROM customers WHERE user_id = $1 LIMIT 1;`, [auth.userId]);
          if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
        }

        if (customerId) {
          const accRes = await testDb.query(
            `SELECT current_balance FROM loyalty_accounts WHERE restaurant_id = $1 AND customer_id = $2 LIMIT 1;`,
            [restaurantId, customerId]
          );
          if (accRes.rows.length > 0) {
            currentBalance = accRes.rows[0].current_balance;
          }
        }
      }

      const rewRes = await testDb.query(
        `SELECT id, restaurant_id, title, description, image_url, cost_points_stamps,
                max_redemptions_per_customer, total_inventory, claimed_inventory,
                valid_from, valid_until,
                (cost_points_stamps <= $2) as is_eligible
         FROM rewards 
         WHERE restaurant_id = $1 AND is_active = TRUE
         ORDER BY cost_points_stamps ASC;`,
        [restaurantId, currentBalance]
      );

      const response: ApiResponse = {
        success: true,
        data: {
          current_balance: currentBalance,
          rewards: rewRes.rows,
        },
        error: null,
      };
      return c.json(response, 200);
    }

    // Production Supabase Mode
    const supabase = getServiceSupabaseClient(c.env);

    if (auth && auth.role === 'CUSTOMER') {
      if (!customerId) {
        const { data: cData } = await supabase.from('customers').select('id').eq('user_id', auth.userId).maybeSingle();
        if (cData) customerId = cData.id;
      }
      if (customerId) {
        const { data: accData } = await supabase
          .from('loyalty_accounts')
          .select('current_balance')
          .eq('restaurant_id', restaurantId)
          .eq('customer_id', customerId)
          .maybeSingle();
        if (accData) currentBalance = accData.current_balance;
      }
    }

    const { data: rewardsData, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('cost_points_stamps', { ascending: true });

    if (error) {
      throw error;
    }

    const formatted = (rewardsData || []).map((r) => ({
      ...r,
      is_eligible: r.cost_points_stamps <= currentBalance,
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        current_balance: currentBalance,
        rewards: formatted,
      },
      error: null,
    };
    return c.json(response, 200);
  }
);

/**
 * POST /api/rewards/:id/redeem
 * Server-Side Atomic Reward Redemption.
 *
 * CRITICAL SECURITY INVARIANTS:
 * - customer_id is NEVER read from frontend payload. Derived from authenticated JWT.
 * - points cost is NEVER trusted from frontend. Derived from verified DB row lock.
 * - Idempotency-Key prevents double debit on network retries.
 * - Atomic database procedure locks account row with FOR UPDATE.
 */
rewardsRouter.post(
  '/:id/redeem',
  authMiddleware(true),
  requireCustomer(),
  tenantMiddleware(false),
  rateLimiter({ windowMs: 60 * 1000, maxRequests: 10, keyPrefix: 'redeem' }),
  async (c) => {
    const rewardId = c.req.param('id');
    const restaurantId = c.get('restaurantId') as string;
    const auth = c.get('auth') as AuthContextUser;
    const idempotencyKey = c.req.header('Idempotency-Key') || null;

    const testDb = getTestDatabaseClient();
    let customerId = auth.customerId;

    if (!customerId) {
      if (testDb) {
        const cRes = await testDb.query(`SELECT id FROM customers WHERE user_id = $1 LIMIT 1;`, [auth.userId]);
        if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
      } else {
        const supabase = getServiceSupabaseClient(c.env);
        const { data: cData } = await supabase.from('customers').select('id').eq('user_id', auth.userId).maybeSingle();
        if (cData) customerId = cData.id;
      }
    }

    if (!customerId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer account not found.' },
      };
      return c.json(response, 404);
    }

    try {
      let redemptionResult: any = null;

      if (testDb) {
        const res = await testDb.query(
          `SELECT fn_issue_reward_redemption(
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            15
          ) as result;`,
          [restaurantId, customerId, rewardId, idempotencyKey]
        );
        redemptionResult = res.rows[0].result;
      } else {
        const supabase = getServiceSupabaseClient(c.env);
        const { data, error } = await supabase.rpc('fn_issue_reward_redemption', {
          p_restaurant_id: restaurantId,
          p_customer_id: customerId,
          p_reward_id: rewardId,
          p_idempotency_key: idempotencyKey,
          p_ttl_minutes: 15,
        });

        if (error) {
          throw new Error(error.message);
        }
        redemptionResult = data;
      }

      const response: ApiResponse = {
        success: true,
        data: redemptionResult,
        error: null,
      };
      return c.json(response, 200);
    } catch (err: any) {
      const message = err.message || 'Redemption failed';
      console.error('[Redeem Error]', message);

      if (message.includes('Insufficient balance')) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'INSUFFICIENT_BALANCE', message },
        };
        return c.json(response, 409);
      }

      if (message.includes('expired') || message.includes('exhausted') || message.includes('inactive')) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'REWARD_UNAVAILABLE', message },
        };
        return c.json(response, 400);
      }

      throw err;
    }
  }
);
