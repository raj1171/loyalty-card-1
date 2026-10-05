// ============================================================================
// File: backend/src/modules/customer/routes.ts
// Description: Customer profile, loyalty card, dashboard, and ledger history
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse, Env, AuthContextUser, ContextVariables } from '../../types/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireCustomer } from '../../middleware/rbac.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';

export const customerRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// All customer routes require authenticated CUSTOMER role
customerRouter.use('/me', authMiddleware(true), requireCustomer());
customerRouter.use('/me/*', authMiddleware(true), requireCustomer());

const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(128).optional(),
  email: z.string().email('Invalid email address').optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be in YYYY-MM-DD format').optional(),
});

/**
 * GET /api/me
 * Retrieve customer profile
 */
customerRouter.get('/me', async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const env = c.env;
  const testDb = getTestDatabaseClient();

  let customer: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT id, user_id, phone, email, full_name, birthday, created_at, updated_at
       FROM customers 
       WHERE user_id = $1 LIMIT 1;`,
      [auth.userId]
    );
    customer = res.rows[0] || null;
  } else {
    const supabase = getServiceSupabaseClient(env);
    const { data } = await supabase
      .from('customers')
      .select('id, user_id, phone, email, full_name, birthday, created_at, updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle();
    customer = data;
  }

  if (!customer) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Customer profile not found.' },
    };
    return c.json(response, 404);
  }

  const response: ApiResponse = {
    success: true,
    data: customer,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * PATCH /api/me
 * Update basic customer profile
 */
customerRouter.patch('/me', async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const validated = updateProfileSchema.parse(body);

  if (Object.keys(validated).length === 0) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'INVALID_PAYLOAD', message: 'No fields provided for update.' },
    };
    return c.json(response, 400);
  }

  const env = c.env;
  const testDb = getTestDatabaseClient();

  let updatedCustomer: any = null;

  if (testDb) {
    const updateFields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (validated.full_name !== undefined) {
      updateFields.push(`full_name = $${idx++}`);
      values.push(validated.full_name);
    }
    if (validated.email !== undefined) {
      updateFields.push(`email = $${idx++}`);
      values.push(validated.email);
    }
    if (validated.birthday !== undefined) {
      updateFields.push(`birthday = $${idx++}`);
      values.push(validated.birthday);
    }
    values.push(auth.userId);

    const res = await testDb.query(
      `UPDATE customers 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE user_id = $${idx}
       RETURNING id, user_id, phone, email, full_name, birthday, updated_at;`,
      values
    );
    updatedCustomer = res.rows[0] || null;
  } else {
    const supabase = getServiceSupabaseClient(env);
    const { data, error } = await supabase
      .from('customers')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId)
      .select('id, user_id, phone, email, full_name, birthday, updated_at')
      .single();

    if (error) {
      throw error;
    }
    updatedCustomer = data;
  }

  const response: ApiResponse = {
    success: true,
    data: updatedCustomer,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/me/dashboard
 * Aggregated Mobile Loyalty Dashboard.
 * Returns: membership, loyalty card balance, recent 5 transactions, active rewards, and active redemptions.
 */
customerRouter.get('/me/dashboard', tenantMiddleware(false), async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const restaurantId = c.get('restaurantId') as string;
  const env = c.env;
  const testDb = getTestDatabaseClient();

  let customerId = auth.customerId;
  let membership: any = null;
  let loyaltyAccount: any = null;
  let recentTransactions: any[] = [];
  let activeRedemptions: any[] = [];
  let availableRewards: any[] = [];
  let activeStampClaim: any = null;
  let restaurantInfo: any = null;

  if (testDb) {
    // 1. Resolve customer ID
    if (!customerId) {
      const cRes = await testDb.query(`SELECT id FROM customers WHERE user_id = $1 LIMIT 1;`, [auth.userId]);
      if (cRes.rows.length > 0) {
        customerId = cRes.rows[0].id;
      }
    }

    if (!customerId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
      };
      return c.json(response, 404);
    }

    // 2. Fetch membership (auto-create if first visit)
    let mRes = await testDb.query(
      `SELECT id, membership_number, joined_at, last_activity_at, is_active
       FROM customer_restaurant_memberships 
       WHERE restaurant_id = $1 AND customer_id = $2 LIMIT 1;`,
      [restaurantId, customerId]
    );

    if (mRes.rows.length === 0) {
      // Auto register membership
      const phoneRes = await testDb.query(`SELECT phone, full_name FROM customers WHERE id = $1;`, [customerId]);
      const { phone, full_name } = phoneRes.rows[0];
      await testDb.query(
        `SELECT fn_register_customer_membership($1::uuid, $2, $3::uuid, $4);`,
        [restaurantId, phone, auth.userId, full_name]
      );
      mRes = await testDb.query(
        `SELECT id, membership_number, joined_at, last_activity_at, is_active
         FROM customer_restaurant_memberships 
         WHERE restaurant_id = $1 AND customer_id = $2 LIMIT 1;`,
        [restaurantId, customerId]
      );
    }
    membership = mRes.rows[0] || null;

    // 3. Loyalty Account Balance
    const accRes = await testDb.query(
      `SELECT id, loyalty_model, current_balance, lifetime_accrued, lifetime_redeemed, version, updated_at
       FROM loyalty_accounts 
       WHERE restaurant_id = $1 AND customer_id = $2 LIMIT 1;`,
      [restaurantId, customerId]
    );
    loyaltyAccount = accRes.rows[0] || null;

    const currentBalance = loyaltyAccount?.current_balance || 0;

    // 4. Recent Transactions
    const txRes = await testDb.query(
      `SELECT id, type, points_stamps, balance_after, description, source, created_at
       FROM loyalty_transactions 
       WHERE restaurant_id = $1 AND customer_id = $2
       ORDER BY created_at DESC LIMIT 5;`,
      [restaurantId, customerId]
    );
    recentTransactions = txRes.rows;

    // 5. Active Unredeemed Codes
    const rdRes = await testDb.query(
      `SELECT r.id, r.code, r.status, r.points_cost, r.issued_at, r.expires_at, rew.title as reward_title
       FROM reward_redemptions r
       JOIN rewards rew ON rew.id = r.reward_id
       WHERE r.restaurant_id = $1 AND r.customer_id = $2 AND r.status = 'ISSUED' AND r.expires_at > NOW()
       ORDER BY r.expires_at ASC;`,
      [restaurantId, customerId]
    );
    activeRedemptions = rdRes.rows;

    // 6. Available Rewards with Server-Calculated Eligibility
    const rewRes = await testDb.query(
      `SELECT id, title, description, image_url, cost_points_stamps,
              (cost_points_stamps <= $2) as is_eligible
       FROM rewards 
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY cost_points_stamps ASC LIMIT 10;`,
      [restaurantId, currentBalance]
    );
    availableRewards = rewRes.rows;

    // 7. Active Stamp Claim (Pending code)
    const claimRes = await testDb.query(
      `SELECT id, code, status, expires_at, created_at
       FROM stamp_claims
       WHERE restaurant_id = $1 AND customer_id = $2 AND status IN ('CREATED', 'DISPLAYED', 'PENDING') AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1;`,
      [restaurantId, customerId]
    );
    activeStampClaim = claimRes.rows[0] || null;

    // 8. Restaurant Info & Settings
    const rInfoRes = await testDb.query(
      `SELECT r.id, r.slug, r.name, r.tagline, r.description, r.brand_color, r.accent_color, r.currency,
              s.loyalty_model, s.stamps_target_count, s.instagram_url, s.facebook_url, s.google_review_url, s.website_url
       FROM restaurants r
       LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
       WHERE r.id = $1 LIMIT 1;`,
      [restaurantId]
    );
    restaurantInfo = rInfoRes.rows[0] || null;
  } else {
    const supabase = getServiceSupabaseClient(env);

    // Resolve customer ID
    if (!customerId) {
      const { data: cData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', auth.userId)
        .single();
      if (cData) {
        customerId = cData.id;
      }
    }

    if (!customerId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
      };
      return c.json(response, 404);
    }

    // Fetch membership
    const { data: mData } = await supabase
      .from('customer_restaurant_memberships')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .maybeSingle();
    membership = mData;

    // Fetch loyalty account
    const { data: accData } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .maybeSingle();
    loyaltyAccount = accData;

    const currentBalance = loyaltyAccount?.current_balance || 0;

    // Fetch recent transactions
    const { data: txData } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points_stamps, balance_after, description, source, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);
    recentTransactions = txData || [];

    // Fetch active redemptions
    const { data: rdData } = await supabase
      .from('reward_redemptions')
      .select('id, code, status, points_cost, issued_at, expires_at, rewards(title)')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .eq('status', 'ISSUED')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    activeRedemptions = rdData || [];

    // Fetch rewards
    const { data: rewData } = await supabase
      .from('rewards')
      .select('id, title, description, image_url, cost_points_stamps')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('cost_points_stamps', { ascending: true })
      .limit(10);

    availableRewards = (rewData || []).map((r) => ({
      ...r,
      is_eligible: r.cost_points_stamps <= currentBalance,
    }));

    // Fetch active stamp claim
    const { data: scData } = await supabase
      .from('stamp_claims')
      .select('id, code, status, expires_at, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .in('status', ['CREATED', 'DISPLAYED', 'PENDING'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .maybeSingle();
    activeStampClaim = scData || null;

    // Fetch restaurant info
    const { data: rRow } = await supabase
      .from('restaurants')
      .select(`
        id, slug, name, tagline, description, brand_color, accent_color, currency,
        restaurant_settings(loyalty_model, stamps_target_count, instagram_url, facebook_url, google_review_url, website_url)
      `)
      .eq('id', restaurantId)
      .maybeSingle();
    if (rRow) {
      const s = (rRow as any).restaurant_settings?.[0] || (rRow as any).restaurant_settings || {};
      restaurantInfo = { ...rRow, ...s };
    }
  }

  const response: ApiResponse = {
    success: true,
    data: {
      restaurant: restaurantInfo,
      membership,
      loyalty_account: loyaltyAccount,
      recent_transactions: recentTransactions,
      active_redemptions: activeRedemptions,
      available_rewards: availableRewards,
      active_stamp_claim: activeStampClaim,
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/me/transactions
 * Paginated loyalty ledger history
 */
customerRouter.get('/me/transactions', tenantMiddleware(false), async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const restaurantId = c.get('restaurantId') as string;
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

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
      error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
    };
    return c.json(response, 404);
  }

  let transactions: any[] = [];
  let totalCount = 0;

  if (testDb) {
    const countRes = await testDb.query(
      `SELECT COUNT(*)::int as count 
       FROM loyalty_transactions 
       WHERE restaurant_id = $1 AND customer_id = $2;`,
      [restaurantId, customerId]
    );
    totalCount = countRes.rows[0].count;

    const listRes = await testDb.query(
      `SELECT id, type, points_stamps, balance_after, description, source, created_at
       FROM loyalty_transactions 
       WHERE restaurant_id = $1 AND customer_id = $2
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4;`,
      [restaurantId, customerId, limit, offset]
    );
    transactions = listRes.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, count, error } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points_stamps, balance_after, description, source, created_at', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }
    transactions = data || [];
    totalCount = count || 0;
  }

  const response: ApiResponse = {
    success: true,
    data: {
      transactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: offset + limit < totalCount,
      },
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/me/redemptions
 * Active unexpired redemption codes
 */
customerRouter.get('/me/redemptions', tenantMiddleware(false), async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const restaurantId = c.get('restaurantId') as string;
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
      error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
    };
    return c.json(response, 404);
  }

  let redemptions: any[] = [];

  if (testDb) {
    const res = await testDb.query(
      `SELECT r.id, r.code, r.status, r.points_cost, r.issued_at, r.expires_at, rew.title as reward_title
       FROM reward_redemptions r
       JOIN rewards rew ON rew.id = r.reward_id
       WHERE r.restaurant_id = $1 AND r.customer_id = $2 AND r.status = 'ISSUED' AND r.expires_at > NOW()
       ORDER BY r.expires_at ASC;`,
      [restaurantId, customerId]
    );
    redemptions = res.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data } = await supabase
      .from('reward_redemptions')
      .select('id, code, status, points_cost, issued_at, expires_at, rewards(title)')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .eq('status', 'ISSUED')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    redemptions = data || [];
  }

  const response: ApiResponse = {
    success: true,
    data: redemptions,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * POST /api/me/stamp-claim/create
 * Generates a single-use 6-digit claim code (e.g. 482917)
 * Atomically executed via fn_create_stamp_claim
 */
customerRouter.post('/me/stamp-claim/create', tenantMiddleware(false), async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const restaurantId = c.get('restaurantId') as string;
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
      error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
    };
    return c.json(response, 404);
  }

  let claimResult: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT fn_create_stamp_claim($1::uuid, $2::uuid) as result;`,
      [restaurantId, customerId]
    );
    claimResult = res.rows[0].result;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('fn_create_stamp_claim', {
      p_restaurant_id: restaurantId,
      p_customer_id: customerId,
    });
    if (error) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'CLAIM_FAILED', message: error.message },
      };
      return c.json(response, 400);
    }
    claimResult = data;
  }

  const response: ApiResponse = {
    success: true,
    data: claimResult,
    error: null,
  };
  return c.json(response, 201);
});

/**
 * GET /api/me/stamp-claim/active
 * Returns current active unexpired stamp claim code if one exists
 */
customerRouter.get('/me/stamp-claim/active', tenantMiddleware(false), async (c) => {
  const auth = c.get('auth') as AuthContextUser;
  const restaurantId = c.get('restaurantId') as string;
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
      error: { code: 'NOT_FOUND', message: 'Customer record not found.' },
    };
    return c.json(response, 404);
  }

  let activeClaim: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT id, code, status, expires_at, created_at
       FROM stamp_claims
       WHERE restaurant_id = $1 AND customer_id = $2 AND status IN ('CREATED', 'DISPLAYED', 'PENDING') AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1;`,
      [restaurantId, customerId]
    );
    activeClaim = res.rows[0] || null;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data } = await supabase
      .from('stamp_claims')
      .select('id, code, status, expires_at, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .in('status', ['CREATED', 'DISPLAYED', 'PENDING'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .maybeSingle();
    activeClaim = data || null;
  }

  const response: ApiResponse = {
    success: true,
    data: activeClaim,
    error: null,
  };
  return c.json(response, 200);
});
