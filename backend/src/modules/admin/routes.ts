// ============================================================================
// File: backend/src/modules/admin/routes.ts
// Description: Restaurant management, catalog CRUD, analytics, staff, and QR codes
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse, Env, AuthContextUser, ContextVariables } from '../../types/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireStaff, requireManagerOrOwner, requireOwner } from '../../middleware/rbac.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';
import { logAuditEvent } from '../../services/audit.js';

export const adminRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// All admin routes require authenticated staff in their assigned restaurant
adminRouter.use('*', authMiddleware(true), requireStaff(), tenantMiddleware(false));

const updateSettingsSchema = z.object({
  loyalty_model: z.enum(['POINTS', 'STAMPS']).optional(),
  points_per_currency_unit: z.number().min(0).optional(),
  stamps_target_count: z.number().int().min(1).optional(),
  stamp_minimum_spend: z.number().min(0).optional(),
  reward_expiry_days: z.number().int().min(1).optional(),
  redemption_code_ttl_minutes: z.number().int().min(1).optional(),
  welcome_bonus_points: z.number().int().min(0).optional(),
  welcome_bonus_stamps: z.number().int().min(0).optional(),
  terms_and_conditions: z.string().optional(),
});

const rewardSchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().max(1000).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  cost_points_stamps: z.number().int().min(1, 'Cost must be at least 1 point or stamp'),
  is_active: z.boolean().default(true),
  max_redemptions_per_customer: z.number().int().min(1).nullable().optional(),
  total_inventory: z.number().int().min(0).nullable().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().nullable().optional(),
});

const inviteStaffSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().min(1).max(128),
  role: z.enum(['STAFF', 'MANAGER', 'OWNER']).default('STAFF'),
});

const createQrCodeSchema = z.object({
  label: z.string().min(1).max(128),
  code_identifier: z.string().min(2).max(64),
  location_tag: z.string().max(64).optional(),
  target_path: z.string().min(1).max(255),
});

/**
 * GET /api/admin/settings
 * View restaurant loyalty settings
 */
adminRouter.get('/settings', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();

  let settings: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT * FROM restaurant_settings WHERE restaurant_id = $1 LIMIT 1;`,
      [restaurantId]
    );
    settings = res.rows[0] || null;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    settings = data;
  }

  const response: ApiResponse = {
    success: true,
    data: settings,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * PATCH /api/admin/settings
 * Update restaurant settings (Manager / Owner only)
 */
adminRouter.patch('/settings', requireManagerOrOwner(), async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const validated = updateSettingsSchema.parse(body);

  if (Object.keys(validated).length === 0) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'INVALID_PAYLOAD', message: 'No fields provided for update.' },
    };
    return c.json(response, 400);
  }

  const testDb = getTestDatabaseClient();

  let updated: any = null;

  if (testDb) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(validated)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    values.push(restaurantId);

    const res = await testDb.query(
      `UPDATE restaurant_settings 
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE restaurant_id = $${idx}
       RETURNING *;`,
      values
    );
    updated = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('restaurant_settings')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) throw error;
    updated = data;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'SETTINGS_UPDATED',
    targetEntity: 'restaurant_settings',
    targetId: restaurantId,
    details: validated,
  });

  const response: ApiResponse = {
    success: true,
    data: updated,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/rewards
 * List all rewards for this restaurant (active and inactive)
 */
adminRouter.get('/rewards', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();

  let rewards: any[] = [];

  if (testDb) {
    const res = await testDb.query(
      `SELECT * FROM rewards WHERE restaurant_id = $1 ORDER BY created_at DESC;`,
      [restaurantId]
    );
    rewards = res.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    rewards = data || [];
  }

  const response: ApiResponse = {
    success: true,
    data: rewards,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * POST /api/admin/rewards
 * Create new reward (Manager / Owner only)
 */
adminRouter.post('/rewards', requireManagerOrOwner(), async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const validated = rewardSchema.parse(body);
  const testDb = getTestDatabaseClient();

  let created: any = null;

  if (testDb) {
    const res = await testDb.query(
      `INSERT INTO rewards (
        restaurant_id, title, description, image_url, cost_points_stamps,
        is_active, max_redemptions_per_customer, total_inventory, valid_from, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()), $10::timestamptz)
      RETURNING *;`,
      [
        restaurantId,
        validated.title,
        validated.description || null,
        validated.image_url || null,
        validated.cost_points_stamps,
        validated.is_active ?? true,
        validated.max_redemptions_per_customer ?? null,
        validated.total_inventory ?? null,
        validated.valid_from || null,
        validated.valid_until || null,
      ]
    );
    created = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        restaurant_id: restaurantId,
        ...validated,
      })
      .select('*')
      .single();

    if (error) throw error;
    created = data;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'REWARD_CREATED',
    targetEntity: 'rewards',
    targetId: created.id,
    details: { title: created.title, cost: created.cost_points_stamps },
  });

  const response: ApiResponse = {
    success: true,
    data: created,
    error: null,
  };
  return c.json(response, 201);
});

/**
 * PATCH /api/admin/rewards/:id
 * Update reward item (Manager / Owner only)
 */
adminRouter.patch('/rewards/:id', requireManagerOrOwner(), async (c) => {
  const rewardId = c.req.param('id');
  if (!rewardId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rewardId)) {
    return c.json({ success: false, data: null, error: { code: 'INVALID_UUID', message: 'Invalid reward ID format.' } }, 400);
  }
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const validated = rewardSchema.partial().parse(body);

  if (Object.keys(validated).length === 0) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'INVALID_PAYLOAD', message: 'No fields provided for update.' },
    };
    return c.json(response, 400);
  }

  const testDb = getTestDatabaseClient();

  let updated: any = null;

  if (testDb) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(validated)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    values.push(rewardId);
    values.push(restaurantId);

    const res = await testDb.query(
      `UPDATE rewards 
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx++} AND restaurant_id = $${idx}
       RETURNING *;`,
      values
    );

    if (res.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Reward not found.' },
      };
      return c.json(response, 404);
    }
    updated = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('rewards')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rewardId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) throw error;
    updated = data;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'REWARD_UPDATED',
    targetEntity: 'rewards',
    targetId: rewardId,
    details: validated,
  });

  const response: ApiResponse = {
    success: true,
    data: updated,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * DELETE /api/admin/rewards/:id
 * Deactivate / delete reward (Manager / Owner only)
 */
adminRouter.delete('/rewards/:id', requireManagerOrOwner(), async (c) => {
  const rewardId = c.req.param('id');
  if (!rewardId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rewardId)) {
    return c.json({ success: false, data: null, error: { code: 'INVALID_UUID', message: 'Invalid reward ID format.' } }, 400);
  }
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const testDb = getTestDatabaseClient();

  if (testDb) {
    // Soft delete by marking inactive
    const res = await testDb.query(
      `UPDATE rewards SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND restaurant_id = $2 RETURNING id;`,
      [rewardId, restaurantId]
    );
    if (res.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Reward not found.' },
      };
      return c.json(response, 404);
    }
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { error } = await supabase
      .from('rewards')
      .update({ is_active: false })
      .eq('id', rewardId)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'REWARD_DEACTIVATED',
    targetEntity: 'rewards',
    targetId: rewardId,
  });

  const response: ApiResponse = {
    success: true,
    data: { message: 'Reward deactivated successfully.' },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/customers
 * List customers of this restaurant with balance, member number, join date
 */
adminRouter.get('/customers', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const search = c.req.query('search') || '';
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

  const testDb = getTestDatabaseClient();
  let customers: any[] = [];
  let total = 0;

  if (testDb) {
    const countRes = await testDb.query(
      `SELECT COUNT(*)::int as count 
       FROM customer_restaurant_memberships m
       JOIN customers c ON c.id = m.customer_id
       WHERE m.restaurant_id = $1 
         AND (c.full_name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%');`,
      [restaurantId, search]
    );
    total = countRes.rows[0].count;

    const listRes = await testDb.query(
      `SELECT c.id, c.full_name, c.phone, c.email, m.membership_number, m.joined_at, m.last_activity_at,
              COALESCE(a.current_balance, 0) as current_balance,
              COALESCE(a.lifetime_accrued, 0) as lifetime_accrued,
              COALESCE(a.lifetime_redeemed, 0) as lifetime_redeemed,
              a.loyalty_model
       FROM customer_restaurant_memberships m
       JOIN customers c ON c.id = m.customer_id
       LEFT JOIN loyalty_accounts a ON a.restaurant_id = m.restaurant_id AND a.customer_id = m.customer_id
       WHERE m.restaurant_id = $1 
         AND (c.full_name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%')
       ORDER BY m.last_activity_at DESC
       LIMIT $3 OFFSET $4;`,
      [restaurantId, search, limit, offset]
    );
    customers = listRes.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, count, error } = await supabase
      .from('customer_restaurant_memberships')
      .select(`
        customer_id, membership_number, joined_at, last_activity_at,
        customers(id, full_name, phone, email)
      `, { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    total = count || 0;
    customers = data || [];
  }

  const response: ApiResponse = {
    success: true,
    data: {
      customers,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/transactions
 * Auditable transaction log for this restaurant
 */
adminRouter.get('/transactions', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

  const testDb = getTestDatabaseClient();
  let transactions: any[] = [];
  let total = 0;

  if (testDb) {
    const countRes = await testDb.query(
      `SELECT COUNT(*)::int as count FROM loyalty_transactions WHERE restaurant_id = $1;`,
      [restaurantId]
    );
    total = countRes.rows[0].count;

    const listRes = await testDb.query(
      `SELECT t.id, t.type, t.points_stamps, t.balance_after, t.description, t.source, t.created_at,
              c.full_name as customer_name, c.phone as customer_phone
       FROM loyalty_transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE t.restaurant_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [restaurantId, limit, offset]
    );
    transactions = listRes.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, count, error } = await supabase
      .from('loyalty_transactions')
      .select(`
        id, type, points_stamps, balance_after, description, source, created_at,
        customers(full_name, phone)
      `, { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    total = count || 0;
    transactions = data || [];
  }

  const response: ApiResponse = {
    success: true,
    data: {
      transactions,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/analytics
 * Aggregated analytics: members count, points issued vs redeemed, redemptions count
 */
adminRouter.get('/analytics', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();

  let analyticsData: any = {};

  if (testDb) {
    // 1. Total Members
    const membersRes = await testDb.query(
      `SELECT COUNT(*)::int as total_members FROM customer_restaurant_memberships WHERE restaurant_id = $1;`,
      [restaurantId]
    );

    // 2. Points / Stamps stats
    const pointsRes = await testDb.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN points_stamps > 0 THEN points_stamps ELSE 0 END), 0)::int as total_issued,
         COALESCE(SUM(CASE WHEN points_stamps < 0 THEN ABS(points_stamps) ELSE 0 END), 0)::int as total_redeemed
       FROM loyalty_transactions 
       WHERE restaurant_id = $1;`,
      [restaurantId]
    );

    // 3. Redemptions count by status
    const redemptionsRes = await testDb.query(
      `SELECT 
         COUNT(*)::int as total_requested,
         COUNT(CASE WHEN status = 'REDEEMED' THEN 1 END)::int as total_fulfilled,
         COUNT(CASE WHEN status = 'ISSUED' AND expires_at > NOW() THEN 1 END)::int as total_active
       FROM reward_redemptions 
       WHERE restaurant_id = $1;`,
      [restaurantId]
    );

    // 4. Total Visits
    const visitsRes = await testDb.query(
      `SELECT COUNT(*)::int as total_visits, COALESCE(SUM(spend_amount), 0)::numeric(10,2) as total_spend
       FROM visits 
       WHERE restaurant_id = $1;`,
      [restaurantId]
    );

    analyticsData = {
      total_members: membersRes.rows[0].total_members,
      points_issued: pointsRes.rows[0].total_issued,
      points_redeemed: pointsRes.rows[0].total_redeemed,
      redemptions: redemptionsRes.rows[0],
      visits: visitsRes.rows[0],
    };
  } else {
    // Supabase aggregates
    analyticsData = {
      total_members: 0,
      points_issued: 0,
      points_redeemed: 0,
      redemptions: { total_requested: 0, total_fulfilled: 0, total_active: 0 },
      visits: { total_visits: 0, total_spend: 0 },
    };
  }

  const response: ApiResponse = {
    success: true,
    data: analyticsData,
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/staff & POST /api/admin/staff/invite (Owner only)
 */
adminRouter.get('/staff', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();
  let staff: any[] = [];

  if (testDb) {
    const res = await testDb.query(
      `SELECT id, user_id, email, full_name, role, is_active, created_at
       FROM restaurant_staff 
       WHERE restaurant_id = $1 
       ORDER BY created_at ASC;`,
      [restaurantId]
    );
    staff = res.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data } = await supabase
      .from('restaurant_staff')
      .select('id, user_id, email, full_name, role, is_active, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });
    staff = data || [];
  }

  const response: ApiResponse = { success: true, data: staff, error: null };
  return c.json(response, 200);
});

adminRouter.post('/staff/invite', requireOwner(), async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const { user_id, email, full_name, role } = inviteStaffSchema.parse(body);
  const testDb = getTestDatabaseClient();

  let invited: any = null;

  if (testDb) {
    const res = await testDb.query(
      `INSERT INTO restaurant_staff (restaurant_id, user_id, email, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, email, full_name, role, is_active, created_at;`,
      [restaurantId, user_id, email, full_name, role]
    );
    invited = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('restaurant_staff')
      .insert({ restaurant_id: restaurantId, user_id, email, full_name, role })
      .select('*')
      .single();

    if (error) throw error;
    invited = data;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'STAFF_INVITED',
    targetEntity: 'restaurant_staff',
    targetId: invited.id,
    details: { email, role },
  });

  const response: ApiResponse = { success: true, data: invited, error: null };
  return c.json(response, 201);
});

/**
 * GET /api/admin/qr-codes & POST /api/admin/qr-codes
 */
adminRouter.get('/qr-codes', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();
  let codes: any[] = [];

  if (testDb) {
    const res = await testDb.query(
      `SELECT * FROM qr_codes WHERE restaurant_id = $1 ORDER BY created_at DESC;`,
      [restaurantId]
    );
    codes = res.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data } = await supabase.from('qr_codes').select('*').eq('restaurant_id', restaurantId);
    codes = data || [];
  }

  const response: ApiResponse = { success: true, data: codes, error: null };
  return c.json(response, 200);
});

adminRouter.post('/qr-codes', requireManagerOrOwner(), async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const body = await c.req.json();
  const { label, code_identifier, location_tag, target_path } = createQrCodeSchema.parse(body);
  const testDb = getTestDatabaseClient();

  let created: any = null;

  if (testDb) {
    const res = await testDb.query(
      `INSERT INTO qr_codes (restaurant_id, label, code_identifier, location_tag, target_path)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [restaurantId, label, code_identifier, location_tag || null, target_path]
    );
    created = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('qr_codes')
      .insert({ restaurant_id: restaurantId, label, code_identifier, location_tag, target_path })
      .select('*')
      .single();

    if (error) throw error;
    created = data;
  }

  const response: ApiResponse = { success: true, data: created, error: null };
  return c.json(response, 201);
});

/**
 * GET /api/admin/redemptions
 * List customer reward redemptions with status filtering
 */
adminRouter.get('/redemptions', async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const status = c.req.query('status');
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

  const testDb = getTestDatabaseClient();
  let redemptions: any[] = [];
  let total = 0;

  if (testDb) {
    let whereClause = 'WHERE r.restaurant_id = $1';
    const params: any[] = [restaurantId];
    if (status) {
      params.push(status);
      whereClause += ` AND r.status = $${params.length}`;
    }

    const countRes = await testDb.query(
      `SELECT COUNT(*)::int as count FROM reward_redemptions r ${whereClause};`,
      params
    );
    total = countRes.rows[0].count;

    params.push(limit);
    params.push(offset);
    const listRes = await testDb.query(
      `SELECT r.id, r.code, r.status, r.points_cost, r.issued_at, r.expires_at, r.redeemed_at,
              rew.title as reward_title,
              c.full_name as customer_name, c.phone as customer_phone
       FROM reward_redemptions r
       JOIN rewards rew ON rew.id = r.reward_id
       JOIN customers c ON c.id = r.customer_id
       ${whereClause}
       ORDER BY r.requested_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );
    redemptions = listRes.rows;
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    let query = supabase
      .from('reward_redemptions')
      .select(`
        id, code, status, points_cost, issued_at, expires_at, redeemed_at,
        rewards(title),
        customers(full_name, phone)
      `, { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('requested_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    total = count || 0;
    redemptions = (data || []).map((d: any) => ({
      ...d,
      reward_title: d.rewards?.title,
      customer_name: d.customers?.full_name,
      customer_phone: d.customers?.phone,
    }));
  }

  const response: ApiResponse = {
    success: true,
    data: {
      redemptions,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/admin/customers/:id
 * Customer detailed profile, membership, balance, and recent transactions
 */
adminRouter.get('/customers/:id', async (c) => {
  const customerId = c.req.param('id');
  if (!customerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
    return c.json({ success: false, data: null, error: { code: 'INVALID_UUID', message: 'Invalid customer ID format.' } }, 400);
  }
  const restaurantId = c.get('restaurantId') as string;
  const testDb = getTestDatabaseClient();

  let customerDetails: any = null;

  if (testDb) {
    const cRes = await testDb.query(
      `SELECT c.id, c.full_name, c.phone, c.email, c.birthday, c.created_at,
              m.membership_number, m.joined_at, m.last_activity_at,
              COALESCE(a.current_balance, 0) as current_balance,
              COALESCE(a.lifetime_accrued, 0) as lifetime_accrued,
              COALESCE(a.lifetime_redeemed, 0) as lifetime_redeemed,
              a.loyalty_model, a.id as account_id
       FROM customer_restaurant_memberships m
       JOIN customers c ON c.id = m.customer_id
       LEFT JOIN loyalty_accounts a ON a.restaurant_id = m.restaurant_id AND a.customer_id = m.customer_id
       WHERE m.restaurant_id = $1 AND c.id = $2 LIMIT 1;`,
      [restaurantId, customerId]
    );

    if (cRes.rows.length === 0) {
      return c.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Customer not found.' } }, 404);
    }

    const txRes = await testDb.query(
      `SELECT id, type, points_stamps, balance_after, description, source, created_at
       FROM loyalty_transactions
       WHERE restaurant_id = $1 AND customer_id = $2
       ORDER BY created_at DESC LIMIT 20;`,
      [restaurantId, customerId]
    );

    customerDetails = {
      ...cRes.rows[0],
      recent_transactions: txRes.rows,
    };
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data: member } = await supabase
      .from('customer_restaurant_memberships')
      .select(`
        membership_number, joined_at, last_activity_at,
        customers(id, full_name, phone, email, birthday, created_at),
        loyalty_accounts(current_balance, lifetime_accrued, lifetime_redeemed, loyalty_model, id)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!member) {
      return c.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Customer not found.' } }, 404);
    }

    const { data: txs } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points_stamps, balance_after, description, source, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    customerDetails = {
      ...(member.customers as any),
      membership_number: member.membership_number,
      joined_at: member.joined_at,
      last_activity_at: member.last_activity_at,
      current_balance: (member.loyalty_accounts as any)?.current_balance || 0,
      lifetime_accrued: (member.loyalty_accounts as any)?.lifetime_accrued || 0,
      lifetime_redeemed: (member.loyalty_accounts as any)?.lifetime_redeemed || 0,
      loyalty_model: (member.loyalty_accounts as any)?.loyalty_model || 'POINTS',
      recent_transactions: txs || [],
    };
  }

  return c.json({ success: true, data: customerDetails, error: null }, 200);
});

/**
 * POST /api/admin/customers/:id/adjust
 * Manual points or stamps balance adjustment (Manager / Owner only)
 * Uses atomic fn_adjust_customer_balance with FOR UPDATE row locking
 */
adminRouter.post('/customers/:id/adjust', requireManagerOrOwner(), async (c) => {
  const customerId = c.req.param('id');
  if (!customerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
    return c.json({ success: false, data: null, error: { code: 'INVALID_UUID', message: 'Invalid customer ID format.' } }, 400);
  }
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const schema = z.object({
    points_stamps: z.number().int().refine((n) => n !== 0, 'Adjustment must not be 0'),
    reason: z.string().min(2).max(255),
  });
  const { points_stamps, reason } = schema.parse(body);
  const testDb = getTestDatabaseClient();

  let updatedBalance = 0;

  if (testDb) {
    try {
      const res = await testDb.query(
        `SELECT fn_adjust_customer_balance($1::uuid, $2::uuid, $3::uuid, $4::int, $5::text) as result;`,
        [restaurantId, customerId, auth.userId, points_stamps, reason]
      );
      const result = res.rows[0].result;
      updatedBalance = result.current_balance;
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return c.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: err.message } }, 404);
      }
      if (err.message?.includes('negative balance')) {
        return c.json({ success: false, data: null, error: { code: 'INSUFFICIENT_BALANCE', message: 'Adjustment would result in negative balance.' } }, 400);
      }
      if (err.message?.includes('Unauthorized')) {
        return c.json({ success: false, data: null, error: { code: 'FORBIDDEN', message: err.message } }, 403);
      }
      throw err;
    }
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('fn_adjust_customer_balance', {
      p_restaurant_id: restaurantId,
      p_customer_id: customerId,
      p_staff_user_id: auth.userId,
      p_adjustment: points_stamps,
      p_reason: reason,
    });

    if (error) {
      if (error.message?.includes('not found')) {
        return c.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: error.message } }, 404);
      }
      if (error.message?.includes('negative balance')) {
        return c.json({ success: false, data: null, error: { code: 'INSUFFICIENT_BALANCE', message: 'Adjustment would result in negative balance.' } }, 400);
      }
      if (error.message?.includes('Unauthorized')) {
        return c.json({ success: false, data: null, error: { code: 'FORBIDDEN', message: error.message } }, 403);
      }
      throw error;
    }

    updatedBalance = (data as any)?.current_balance ?? 0;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'MANUAL_BALANCE_ADJUSTMENT',
    targetEntity: 'loyalty_accounts',
    targetId: customerId,
    details: { points_stamps, reason, new_balance: updatedBalance },
  });

  return c.json({ success: true, data: { current_balance: updatedBalance }, error: null }, 200);
});

/**
 * PATCH /api/admin/restaurant
 * Update restaurant details (Owner only)
 */
adminRouter.patch('/restaurant', requireOwner(), async (c) => {
  const restaurantId = c.get('restaurantId') as string;
  const auth = c.get('auth') as AuthContextUser;
  const body = await c.req.json();
  const updateRestaurantSchema = z.object({
    name: z.string().min(1).max(128).optional(),
    tagline: z.string().max(256).nullable().optional(),
    logo_url: z.string().nullable().optional(),
    brand_color: z.string().max(16).optional(),
    accent_color: z.string().max(16).optional(),
    currency: z.string().max(8).optional(),
  });
  const validated = updateRestaurantSchema.parse(body);

  if (Object.keys(validated).length === 0) {
    return c.json({ success: false, data: null, error: { code: 'INVALID_PAYLOAD', message: 'No fields provided for update.' } }, 400);
  }

  const testDb = getTestDatabaseClient();

  let updated: any = null;

  if (testDb) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(validated)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    values.push(restaurantId);

    const res = await testDb.query(
      `UPDATE restaurants SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *;`,
      values
    );
    updated = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('restaurants')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', restaurantId)
      .select('*')
      .single();

    if (error) throw error;
    updated = data;
  }

  await logAuditEvent(c.env, {
    restaurantId,
    actor: auth,
    action: 'RESTAURANT_DETAILS_UPDATED',
    targetEntity: 'restaurants',
    targetId: restaurantId,
    details: validated,
  });

  return c.json({ success: true, data: updated, error: null }, 200);
});
