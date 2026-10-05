// ============================================================================
// File: backend/src/config/env.ts
// Description: Validated environment variables and bindings parser
// ============================================================================

import { z } from 'zod';
import type { Env } from '../types/index.js';

const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'production', 'test']).default('production'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function getValidatedEnv(env: Env): ValidatedEnv {
  const result = envSchema.safeParse({
    ENVIRONMENT: env.ENVIRONMENT || 'production',
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
