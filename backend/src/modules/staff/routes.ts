// ============================================================================
// File: backend/src/modules/staff/routes.ts
// Description: Staff in-store redemption verification, fulfillment, and visit logging
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse, Env, AuthContextUser, ContextVariables } from '../../types/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireStaff } from '../../middleware/rbac.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';

export const staffRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// All staff endpoints require authenticated staff/manager/owner in their assigned restaurant
staffRouter.use('*', authMiddleware(true), requireStaff(), tenantMiddleware(false));

const verifyCodeSchema = z.object({
  code: z.string().min(5).max(16).transform((val) => val.toUpperCase().trim()),
});

const fulfillCodeSchema = z.object({
  code: z.string().min(5).max(16).transform((val) => val.toUpperCase().trim()),
  notes: z.string().max(255).optional(),
});

const recordVisitSchema = z.object({
  customer_phone: z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
  customer_id: z.string().uuid().optional(),
  membership_number: z.string().max(32).optional(),
  spend_amount: z.number().min(0, 'Spend amount must be greater than or equal to 0').max(50000, 'Spend amount cannot exceed 50,000 per transaction').default(0),
  notes: z.string().max(255).optional(),
});

/**
 * POST /api/staff/redemptions/verify
 * Scan / enter customer code to preview reward details and validity
 */
staffRouter.post('/redemptions/verify', async (c) => {
  const body = await c.req.json();
  const { code } = verifyCodeSchema.parse(body);
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();

  let redemption: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT r.id, r.code, r.status, r.points_cost, r.issued_at, r.expires_at, r.redeemed_at,
              rew.title as reward_title, rew.description as reward_description,
              c.full_name as customer_name, c.phone as customer_phone
       FROM reward_redemptions r
       JOIN rewards rew ON rew.id = r.reward_id
       JOIN customers c ON c.id = r.customer_id
       WHERE r.restaurant_id = $1 AND r.code = $2 LIMIT 1;`,
      [restaurantId, code]
    );

    if (res.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Redemption code not found for this restaurant.' },
      };
      return c.json(response, 404);
    }
    redemption = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select(`
        id, code, status, points_cost, issued_at, expires_at, redeemed_at,
        rewards(title, description),
        customers(full_name, phone)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('code', code)
      .maybeSingle();

    if (error || !data) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Redemption code not found for this restaurant.' },
      };
      return c.json(response, 404);
    }

    redemption = {
      id: data.id,
      code: data.code,
      status: data.status,
      points_cost: data.points_cost,
      issued_at: data.issued_at,
      expires_at: data.expires_at,
      redeemed_at: data.redeemed_at,
      reward_title: (data.rewards as any)?.title,
      reward_description: (data.rewards as any)?.description,
      customer_name: (data.customers as any)?.full_name,
      customer_phone: (data.customers as any)?.phone,
    };
  }

  const isExpired = new Date(redemption.expires_at).getTime() < Date.now();
  const isValid = redemption.status === 'ISSUED' && !isExpired;

  const response: ApiResponse = {
    success: true,
    data: {
      ...redemption,
      is_valid: isValid,
      validity_reason: isValid
        ? 'Code is valid and ready for fulfillment.'
        : redemption.status === 'REDEEMED'
        ? `Code was already redeemed at ${redemption.redeemed_at}`
        : isExpired
        ? `Code expired at ${redemption.expires_at}`
        : `Invalid status: ${redemption.status}`,
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * POST /api/staff/redemptions/fulfill
 * In-store staff single-use reward fulfillment.
 * Atomic state transition: ISSUED -> REDEEMED. Replay protected.
 */
staffRouter.post('/redemptions/fulfill', async (c) => {
  const body = await c.req.json();
  const { code, notes } = fulfillCodeSchema.parse(body);
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const testDb = getTestDatabaseClient();

  try {
    let result: any = null;

    if (testDb) {
      const res = await testDb.query(
        `SELECT fn_fulfill_reward_redemption($1::uuid, $2, $3::uuid, $4) as result;`,
        [restaurantId, code, auth.userId, notes || null]
      );
      result = res.rows[0].result;
    } else {
      const supabase = getServiceSupabaseClient(c.env);
      const { data, error } = await supabase.rpc('fn_fulfill_reward_redemption', {
        p_restaurant_id: restaurantId,
        p_code: code,
        p_staff_user_id: auth.userId,
        p_notes: notes || null,
      });

      if (error) {
        throw new Error(error.message);
      }
      result = data;
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      error: null,
    };
    return c.json(response, 200);
  } catch (err: any) {
    const message = err.message || 'Fulfillment failed';
    console.error('[Fulfillment Error]', message);

    if (message.includes('already been redeemed')) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'ALREADY_REDEEMED', message },
      };
      return c.json(response, 409);
    }

    if (message.includes('expired')) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'CODE_EXPIRED', message },
      };
      return c.json(response, 400);
    }

    throw err;
  }
});

/**
 * POST /api/staff/visits/record
 * Record customer purchase or visit.
 * Points or stamps are calculated server-side according to restaurant settings.
 */
staffRouter.post('/visits/record', async (c) => {
  const body = await c.req.json();
  const { customer_phone, customer_id, membership_number, spend_amount, notes } = recordVisitSchema.parse(body);
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const testDb = getTestDatabaseClient();
  const idempotencyKey = c.req.header('Idempotency-Key') || null;

  let resolvedCustomerId = customer_id;

  if (!resolvedCustomerId && customer_phone) {
    if (testDb) {
      const cRes = await testDb.query(`SELECT id FROM customers WHERE phone = $1 LIMIT 1;`, [customer_phone]);
      if (cRes.rows.length > 0) resolvedCustomerId = cRes.rows[0].id;
    } else {
      const supabase = getServiceSupabaseClient(c.env);
      const { data } = await supabase.from('customers').select('id').eq('phone', customer_phone).maybeSingle();
      if (data) resolvedCustomerId = data.id;
    }
  }

  if (!resolvedCustomerId && membership_number) {
    if (testDb) {
      const mRes = await testDb.query(
        `SELECT customer_id FROM customer_restaurant_memberships WHERE restaurant_id = $1 AND membership_number = $2 LIMIT 1;`,
        [restaurantId, membership_number]
      );
      if (mRes.rows.length > 0) resolvedCustomerId = mRes.rows[0].customer_id;
    } else {
      const supabase = getServiceSupabaseClient(c.env);
      const { data } = await supabase
        .from('customer_restaurant_memberships')
        .select('customer_id')
        .eq('restaurant_id', restaurantId)
        .eq('membership_number', membership_number)
        .maybeSingle();
      if (data) resolvedCustomerId = data.customer_id;
    }
  }

  if (!resolvedCustomerId) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Customer not found. Please provide valid customer_phone, customer_id, or membership_number.' },
    };
    return c.json(response, 404);
  }

  let visitResult: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT fn_record_customer_visit($1::uuid, $2::uuid, $3::uuid, $4, $5, $6) as result;`,
      [restaurantId, resolvedCustomerId, auth.userId, spend_amount, notes || null, idempotencyKey]
    );
    visitResult = res.rows[0].result;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('fn_record_customer_visit', {
      p_restaurant_id: restaurantId,
      p_customer_id: resolvedCustomerId,
      p_staff_user_id: auth.userId,
      p_spend_amount: spend_amount,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw new Error(error.message);
    }
    visitResult = data;
  }

  const response: ApiResponse = {
    success: true,
    data: visitResult,
    error: null,
  };
  return c.json(response, 200);
});

const stampClaimCodeSchema = z.object({
  code: z.string().min(4).max(12).transform((val) => val.trim()),
});

const consumeStampClaimSchema = z.object({
  code: z.string().min(4).max(12).transform((val) => val.trim()),
  notes: z.string().max(255).optional(),
});

/**
 * POST /api/staff/stamp-claims/verify
 * Cashier enters customer 6-digit claim code to preview customer name, current stamp progress, and eligibility
 */
staffRouter.post('/stamp-claims/verify', async (c) => {
  const body = await c.req.json();
  const { code } = stampClaimCodeSchema.parse(body);
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const testDb = getTestDatabaseClient();

  let verifyResult: any = null;

  if (testDb) {
    try {
      const res = await testDb.query(
        `SELECT fn_verify_stamp_claim($1::uuid, $2, $3::uuid) as result;`,
        [restaurantId, code, auth.userId]
      );
      verifyResult = res.rows[0].result;
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'INVALID_CLAIM_CODE', message: err.message || 'Verification failed.' },
      };
      return c.json(response, 400);
    }
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('fn_verify_stamp_claim', {
      p_restaurant_id: restaurantId,
      p_code: code,
      p_staff_user_id: auth.userId,
    });
    if (error) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'INVALID_CLAIM_CODE', message: error.message },
      };
      return c.json(response, 400);
    }
    verifyResult = data;
  }

  const response: ApiResponse = {
    success: true,
    data: verifyResult,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * POST /api/staff/stamp-claims/consume
 * Cashier confirms stamp award. Atomically updates loyalty ledger and marks claim code as CONSUMED.
 */
staffRouter.post('/stamp-claims/consume', async (c) => {
  const body = await c.req.json();
  const { code, notes } = consumeStampClaimSchema.parse(body);
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const testDb = getTestDatabaseClient();

  let consumeResult: any = null;

  if (testDb) {
    try {
      const res = await testDb.query(
        `SELECT fn_consume_stamp_claim($1::uuid, $2, $3::uuid, $4) as result;`,
        [restaurantId, code, auth.userId, notes || 'Cashier stamp award']
      );
      consumeResult = res.rows[0].result;
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'CONSUME_FAILED', message: err.message || 'Stamp claim consumption failed.' },
      };
      return c.json(response, 400);
    }
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('fn_consume_stamp_claim', {
      p_restaurant_id: restaurantId,
      p_code: code,
      p_staff_user_id: auth.userId,
      p_notes: notes || 'Cashier stamp award',
    });
    if (error) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'CONSUME_FAILED', message: error.message },
      };
      return c.json(response, 400);
    }
    consumeResult = data;
  }

  const response: ApiResponse = {
    success: true,
    data: consumeResult,
    error: null,
  };
  return c.json(response, 200);
});
