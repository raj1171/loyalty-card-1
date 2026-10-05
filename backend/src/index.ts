// ============================================================================
// File: backend/src/index.ts
// Description: Cloudflare Workers main application entrypoint and routing
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, ContextVariables } from './types/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route modules
import { restaurantRouter } from './modules/restaurant/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { customerRouter } from './modules/customer/routes.js';
import { rewardsRouter } from './modules/rewards/routes.js';
import { staffRouter } from './modules/staff/routes.js';
import { adminRouter } from './modules/admin/routes.js';

export const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// 1. Global Security Headers Middleware
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  await next();
});

// 2. CORS Middleware
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Dynamic origin handling: allow local dev or any requesting origin without wildcard credentials issue
      return origin || '*';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Turnstile-Token', 'X-Restaurant-Id'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400,
  })
);

// 3. Global Error Handler
app.onError(errorHandler);

// 4. System Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'loyalty-backend',
    timestamp: new Date().toISOString(),
  });
});

// 5. Mount Application Modules
app.route('/api', restaurantRouter);
app.route('/api/auth', authRouter);
app.route('/api', customerRouter);
app.route('/api/rewards', rewardsRouter);
app.route('/api/staff', staffRouter);
app.route('/api/admin', adminRouter);

export default app;
