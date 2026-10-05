// ============================================================================
// File: backend/src/modules/auth/routes.ts
// Description: Mobile phone OTP authentication, verification, and customer onboarding
// ============================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse, Env, ContextVariables } from '../../types/index.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from '../../services/supabase.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';

export const authRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number format. Must be 7-15 digits E.164.'),
  turnstile_token: z.string().optional(),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number format.'),
  code: z.string().min(4, 'OTP code must be at least 4 digits').max(8),
  restaurant_id: z.string().uuid('Valid restaurant_id UUID is required').optional(),
  full_name: z.string().max(128).optional(),
});

// In-memory verification store for dev/testing
const devOtpStore = new Map<string, { code: string; expiresAt: number }>();

/**
 * POST /api/auth/otp/send
 * Rate limited to 5 OTP requests per 10 minutes per IP/phone
 */
authRouter.post(
  '/otp/send',
  rateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 5, keyPrefix: 'otp-send' }),
  async (c) => {
    const body = await c.req.json();
    const { phone, turnstile_token } = sendOtpSchema.parse(body);
    const env = c.env;

    // Cloudflare Turnstile Verification in production
    if (env.ENVIRONMENT === 'production' && env.TURNSTILE_SECRET_KEY) {
      if (!turnstile_token) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'BOT_CHECK_REQUIRED', message: 'Turnstile verification token is required.' },
        };
        return c.json(response, 400);
      }

      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET_KEY,
            response: turnstile_token,
          }),
        });
        const outcome: any = await verifyRes.json();
        if (!outcome.success) {
          const response: ApiResponse = {
            success: false,
            data: null,
            error: { code: 'BOT_CHECK_FAILED', message: 'Turnstile bot verification failed.' },
          };
          return c.json(response, 403);
        }
      } catch (err) {
        console.error('Turnstile verification error:', err);
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'BOT_CHECK_ERROR', message: 'Bot verification service temporarily unavailable.' },
        };
        return c.json(response, 503);
      }
    }

    const testDb = getTestDatabaseClient();
    if (testDb) {
      // Dev/Test mode: Store standard dev OTP '123456'
      const devCode = '123456';
      devOtpStore.set(phone, { code: devCode, expiresAt: Date.now() + 10 * 60 * 1000 });

      const response: ApiResponse = {
        success: true,
        data: {
          phone,
          message: 'OTP sent successfully (Dev mode code: 123456)',
          ttl_seconds: 600,
        },
        error: null,
      };
      return c.json(response, 200);
    }

    // Production mode: Send SMS OTP via Supabase Auth
    const supabase = getServiceSupabaseClient(env);
    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: { code: 'OTP_SEND_FAILED', message: error.message },
      };
      return c.json(response, 400);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        phone,
        message: 'OTP sent successfully via SMS.',
        ttl_seconds: 600,
      },
      error: null,
    };
    return c.json(response, 200);
  }
);

/**
 * POST /api/auth/otp/verify
 * Validates OTP code, signs in user, and initializes restaurant membership if specified
 */
authRouter.post(
  '/otp/verify',
  rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10, keyPrefix: 'otp-verify' }),
  async (c) => {
    const body = await c.req.json();
    const { phone, code, restaurant_id, full_name } = verifyOtpSchema.parse(body);
    const env = c.env;
    const testDb = getTestDatabaseClient();

    let userId: string;
    let sessionToken: string;

    if (testDb) {
      // Dev/Test Verification
      const record = devOtpStore.get(phone);
      const isDevBypass = code === '123456';

      if (!isDevBypass && (!record || record.code !== code || record.expiresAt < Date.now())) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP code.' },
        };
        return c.json(response, 400);
      }

      // Invalidate used OTP immediately to prevent replay attacks
      devOtpStore.delete(phone);

      // Check if phone matches known demo staff or cashier
      if (phone === '+15559990001' || phone === '+919876543999' || phone === 'cashier@sadosacafe.com') {
        userId = 'c3333333-2222-2222-2222-222222222222'; // SA Dosa Cashier (Staff)
      } else if (phone === '+15550000001' || phone === '+919876543210') {
        userId = 'd1111111-1111-1111-1111-111111111111'; // Pradyumna Joshi (3 stamps)
      } else if (phone === '+15550000002' || phone === '+919876543211') {
        userId = 'd2222222-2222-2222-2222-222222222222'; // Ananya Rao (6 stamps)
      } else {
        // Check if customer exists in testDb
        let existingUser = await testDb.query(
          `SELECT id, user_id FROM customers WHERE phone = $1 LIMIT 1;`,
          [phone]
        );

        if (existingUser.rows.length > 0 && existingUser.rows[0].user_id) {
          userId = existingUser.rows[0].user_id;
        } else {
          // Generate new user ID
          const genRes = await testDb.query(`SELECT gen_random_uuid()::text as id;`);
          userId = genRes.rows[0].id;
        }
      }

      sessionToken = `test-token:${userId}`;
    } else {
      // Production Supabase Auth Verification
      const supabase = getServiceSupabaseClient(env);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error || !data.user || !data.session) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: { code: 'INVALID_OTP', message: error?.message || 'Verification failed.' },
        };
        return c.json(response, 400);
      }

      userId = data.user.id;
      sessionToken = data.session.access_token;
    }

    // Customer Onboarding / Membership link
    let membershipDetails: any = null;

    if (restaurant_id) {
      if (testDb) {
        const regRes = await testDb.query(
          `SELECT fn_register_customer_membership($1::uuid, $2, $3::uuid, $4) as result;`,
          [restaurant_id, phone, userId, full_name || null]
        );
        membershipDetails = regRes.rows[0].result;
      } else {
        const supabase = getServiceSupabaseClient(env);
        const { data: regData, error: regErr } = await supabase.rpc(
          'fn_register_customer_membership',
          {
            p_restaurant_id: restaurant_id,
            p_phone: phone,
            p_user_id: userId,
            p_full_name: full_name || null,
          }
        );
        if (!regErr) {
          membershipDetails = regData;
        }
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        session_token: sessionToken,
        user_id: userId,
        phone,
        membership: membershipDetails,
      },
      error: null,
    };
    return c.json(response, 200);
  }
);
