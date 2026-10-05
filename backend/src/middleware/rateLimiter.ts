// ============================================================================
// File: backend/src/middleware/rateLimiter.ts
// Description: Edge sliding-window rate limiting middleware
// ============================================================================

import type { Context, Next } from 'hono';
import type { ApiResponse } from '../types/index.js';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory cache for edge runtime worker instances
const localStore = new Map<string, RateLimitRecord>();

function pruneLocalStore(now: number) {
  if (localStore.size > 500) {
    for (const [key, val] of localStore.entries()) {
      if (val.resetAt <= now) {
        localStore.delete(key);
      }
    }
  }
}

export interface RateLimiterOptions {
  windowMs: number; // e.g., 60,000 ms (1 minute)
  maxRequests: number; // e.g., 60 requests per window
  keyPrefix: string;
}

export function rateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyPrefix } = options;

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      '127.0.0.1';

    const auth = (c.get as any)('auth');
    const identifier = auth?.userId || ip;
    const storeKey = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    // Check Cloudflare KV namespace if bound
    const kv = (c.env as any)?.RATE_LIMIT_KV;
    if (kv) {
      try {
        const kvKey = `ratelimit:${storeKey}`;
        const currentVal = await kv.get(kvKey);
        const currentCount = currentVal ? parseInt(currentVal, 10) : 0;
        const newCount = currentCount + 1;
        const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000));
        await kv.put(kvKey, newCount.toString(), { expirationTtl: ttlSeconds });

        const remaining = Math.max(0, maxRequests - newCount);
        c.header('X-RateLimit-Limit', maxRequests.toString());
        c.header('X-RateLimit-Remaining', remaining.toString());

        if (newCount > maxRequests) {
          c.header('Retry-After', ttlSeconds.toString());
          const response: ApiResponse = {
            success: false,
            data: null,
            error: {
              code: 'TOO_MANY_REQUESTS',
              message: `Too many requests. Please retry after ${ttlSeconds} seconds.`,
            },
          };
          return c.json(response, 429);
        }
        return await next();
      } catch (kvErr) {
        console.warn('KV rate limiting fallback to local store:', kvErr);
      }
    }

    pruneLocalStore(now);

    let record = localStore.get(storeKey);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      localStore.set(storeKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());

    if (record.count > maxRequests) {
      c.header('Retry-After', retryAfterSeconds.toString());
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `Too many requests. Please retry after ${retryAfterSeconds} seconds.`,
        },
      };
      return c.json(response, 429);
    }

    await next();
  };
}
