// ============================================================================
// File: backend/src/modules/restaurant/routes.ts
// Description: Public restaurant landing, branding, and loyalty rules endpoints
// ============================================================================

import { Hono } from 'hono';
import type { ApiResponse, Env, ContextVariables } from '../../types/index.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';

export const restaurantRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * GET /api/r/:slug
 * Public QR Landing endpoint. Returns restaurant branding, settings, and loyalty rules.
 * Edge-cacheable.
 */
restaurantRouter.get('/r/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const env = c.env;
  const testDb = getTestDatabaseClient();

  let restaurant: any = null;
  let settings: any = null;
  let activeRewards: any[] = [];

  if (testDb) {
    const rRes = await testDb.query(
      `SELECT id, slug, name, tagline, description, address, phone_contact, logo_url, brand_color, accent_color, currency, is_active
       FROM restaurants 
       WHERE slug = $1 AND is_active = TRUE LIMIT 1;`,
      [slug]
    );

    if (rRes.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found or inactive.' },
      };
      return c.json(response, 404);
    }
    restaurant = rRes.rows[0];

    const sRes = await testDb.query(
      `SELECT loyalty_model, points_per_currency_unit, stamps_target_count, stamp_minimum_spend,
              reward_expiry_days, redemption_code_ttl_minutes, welcome_bonus_points, welcome_bonus_stamps,
              instagram_url, facebook_url, google_review_url, website_url,
              terms_and_conditions
       FROM restaurant_settings 
       WHERE restaurant_id = $1 LIMIT 1;`,
      [restaurant.id]
    );
    settings = sRes.rows[0] || null;

    const rewRes = await testDb.query(
      `SELECT id, title, description, image_url, cost_points_stamps
       FROM rewards 
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY cost_points_stamps ASC LIMIT 10;`,
      [restaurant.id]
    );
    activeRewards = rewRes.rows;
  } else {
    const supabase = getServiceSupabaseClient(env);
    const { data: rData, error: rErr } = await supabase
      .from('restaurants')
      .select('id, slug, name, tagline, description, address, phone_contact, logo_url, brand_color, accent_color, currency, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (rErr || !rData) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found or inactive.' },
      };
      return c.json(response, 404);
    }
    restaurant = rData;

    const { data: sData } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();
    settings = sData;

    const { data: rewData } = await supabase
      .from('rewards')
      .select('id, title, description, image_url, cost_points_stamps')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('cost_points_stamps', { ascending: true })
      .limit(10);
    activeRewards = rewData || [];
  }

  // Set edge caching headers (e.g. 5 minutes for public branding)
  c.header('Cache-Control', 'public, max-age=300, s-maxage=600');

  const response: ApiResponse = {
    success: true,
    data: {
      restaurant,
      settings,
      sample_rewards: activeRewards,
    },
    error: null,
  };
  return c.json(response, 200);
});

/**
 * GET /api/restaurants/:id
 * Retrieve basic restaurant details by ID
 */
restaurantRouter.get('/restaurants/:id', async (c) => {
  const id = c.req.param('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: { code: 'INVALID_UUID', message: 'Invalid restaurant ID format.' },
    };
    return c.json(response, 400);
  }

  const env = c.env;
  const testDb = getTestDatabaseClient();

  let restaurant: any = null;

  if (testDb) {
    const res = await testDb.query(
      `SELECT id, slug, name, tagline, logo_url, brand_color, accent_color, currency, is_active
       FROM restaurants 
       WHERE id = $1 AND is_active = TRUE LIMIT 1;`,
      [id]
    );
    if (res.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found or inactive.' },
      };
      return c.json(response, 404);
    }
    restaurant = res.rows[0];
  } else {
    const supabase = getServiceSupabaseClient(env);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, slug, name, tagline, logo_url, brand_color, accent_color, currency, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found or inactive.' },
      };
      return c.json(response, 404);
    }
    restaurant = data;
  }

  const response: ApiResponse = {
    success: true,
    data: restaurant,
    error: null,
  };
  return c.json(response, 200);
});
