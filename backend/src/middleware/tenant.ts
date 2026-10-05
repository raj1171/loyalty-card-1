// ============================================================================
// File: backend/src/middleware/tenant.ts
// Description: Multi-tenant isolation middleware enforcing restaurant boundaries
// ============================================================================

import type { Context, Next } from 'hono';
import type { AuthContextUser, Env, Restaurant, ApiResponse } from '../types/index.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../services/supabase.js';

export function tenantMiddleware(optional = false) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthContextUser | undefined;
    const env = c.env as Env;

    // 1. Extract target restaurant ID from route params, query, or headers
    let targetRestaurantId =
      c.req.param('restaurantId') ||
      c.req.query('restaurant_id') ||
      c.req.header('x-restaurant-id');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (targetRestaurantId && !uuidRegex.test(targetRestaurantId)) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid restaurant_id UUID format.',
        },
      };
      return c.json(response, 400);
    }

    // 2. Enforce strict isolation for Staff / Manager / Owner:
    // Staff roles are strictly bound to their assigned restaurantId.
    if (auth && auth.role !== 'CUSTOMER' && auth.role !== 'SUPER_ADMIN') {
      if (!auth.restaurantId) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Staff user is not associated with an active restaurant.',
          },
        };
        return c.json(response, 403);
      }

      // If a staff user explicitly specifies a different restaurant_id, reject immediately!
      if (targetRestaurantId && targetRestaurantId !== auth.restaurantId) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Tenant mismatch: You do not have permission to access data for this restaurant.',
          },
        };
        return c.json(response, 403);
      }

      targetRestaurantId = auth.restaurantId;
    }

    if (!targetRestaurantId) {
      if (optional) {
        return await next();
      }
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required restaurant_id identifier.',
        },
      };
      return c.json(response, 400);
    }

    // 3. Verify restaurant existence and active status in DB
    const testDb = getTestDatabaseClient();
    let restaurant: Restaurant | null = null;

    if (testDb) {
      const res = await testDb.query(
        `SELECT id, slug, name, tagline, logo_url, brand_color, accent_color, currency, is_active, created_at, updated_at
         FROM restaurants 
         WHERE id = $1 LIMIT 1;`,
        [targetRestaurantId]
      );
      if (res.rows.length > 0) {
        restaurant = res.rows[0] as Restaurant;
      }
    } else {
      const supabase = getServiceSupabaseClient(env);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', targetRestaurantId)
        .maybeSingle();

      if (!error && data) {
        restaurant = data as Restaurant;
      }
    }

    if (!restaurant) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Restaurant not found.',
        },
      };
      return c.json(response, 404);
    }

    if (!restaurant.is_active) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'This restaurant is currently inactive.',
        },
      };
      return c.json(response, 403);
    }

    c.set('restaurantId', restaurant.id);
    c.set('restaurant', restaurant);

    return await next();
  };
}
