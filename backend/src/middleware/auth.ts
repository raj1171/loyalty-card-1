// ============================================================================
// File: backend/src/middleware/auth.ts
// Description: Authentication middleware verifying tokens and resolving identity
// ============================================================================

import type { Context, Next } from 'hono';
import type { AuthContextUser, Env, ApiResponse } from '../types/index.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../services/supabase.js';

export function authMiddleware(required = true) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (required) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Missing or invalid Bearer token.',
          },
        };
        return c.json(response, 401);
      }
      return await next();
    }

    const token = authHeader.substring(7).trim();
    const env = c.env as Env;

    try {
      let userId: string | null = null;

      // 1. Resolve User ID from token
      const testDb = getTestDatabaseClient();
      if (testDb) {
        // Test mode token parsing: handles raw UUID or 'test-token:<uuid>'
        if (token.startsWith('test-token:')) {
          userId = token.replace('test-token:', '');
        } else {
          userId = token;
        }
      } else {
        const supabase = getServiceSupabaseClient(env);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          const response: ApiResponse = {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired session token.',
            },
          };
          return c.json(response, 401);
        }
        userId = user.id;
      }

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User identity could not be resolved from token.',
          },
        };
        return c.json(response, 401);
      }

      // 2. Resolve Role and Profile from Database (Server-side derivation)
      let authUser: AuthContextUser | null = null;

      const targetTenantId = c.req.param('restaurantId') || c.req.query('restaurant_id') || c.req.header('x-restaurant-id');

      if (testDb) {
        // Check staff first
        const staffRes = await testDb.query(
          `SELECT id, restaurant_id, email, full_name, role 
           FROM restaurant_staff 
           WHERE user_id = $1 AND is_active = TRUE LIMIT 10;`,
          [userId]
        );

        if (staffRes.rows.length > 0) {
          const staff = (targetTenantId
            ? staffRes.rows.find((s: any) => s.restaurant_id === targetTenantId) || staffRes.rows[0]
            : staffRes.rows[0]);
          authUser = {
            userId,
            role: staff.role,
            email: staff.email,
            fullName: staff.full_name,
            staffId: staff.id,
            restaurantId: staff.restaurant_id,
          };
        } else {
          // Check customer
          const custRes = await testDb.query(
            `SELECT id, phone, email, full_name 
             FROM customers 
             WHERE user_id = $1 LIMIT 1;`,
            [userId]
          );

          if (custRes.rows.length > 0) {
            const cust = custRes.rows[0];
            authUser = {
              userId,
              role: 'CUSTOMER',
              phone: cust.phone,
              email: cust.email || undefined,
              fullName: cust.full_name || undefined,
              customerId: cust.id,
            };
          } else {
            // Authenticated user with no linked profile yet (e.g. freshly verified OTP)
            authUser = {
              userId,
              role: 'CUSTOMER',
            };
          }
        }
      } else {
        const supabase = getServiceSupabaseClient(env);

        // Check restaurant staff
        let staffQuery = supabase
          .from('restaurant_staff')
          .select('id, restaurant_id, email, full_name, role')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (targetTenantId) {
          staffQuery = staffQuery.eq('restaurant_id', targetTenantId);
        }

        const { data: staffList } = await staffQuery.limit(1);
        const staffData = staffList && staffList.length > 0 ? staffList[0] : null;

        if (staffData) {
          authUser = {
            userId,
            role: staffData.role,
            email: staffData.email,
            fullName: staffData.full_name,
            staffId: staffData.id,
            restaurantId: staffData.restaurant_id,
          };
        } else {
          // Check customer
          const { data: customerData } = await supabase
            .from('customers')
            .select('id, phone, email, full_name')
            .eq('user_id', userId)
            .maybeSingle();

          if (customerData) {
            authUser = {
              userId,
              role: 'CUSTOMER',
              phone: customerData.phone,
              email: customerData.email || undefined,
              fullName: customerData.full_name || undefined,
              customerId: customerData.id,
            };
          } else {
            authUser = {
              userId,
              role: 'CUSTOMER',
            };
          }
        }
      }

      c.set('auth', authUser);
      return await next();
    } catch (err: any) {
      console.error('[Auth Middleware Error]', err);
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication verification failed.',
        },
      };
      return c.json(response, 401);
    }
  };
}
