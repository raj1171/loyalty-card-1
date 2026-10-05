// ============================================================================
// File: backend/src/services/supabase.ts
// Description: Supabase client provider and query abstraction
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types/index.js';

let mockDbClient: any = null;

/**
 * Allows automated tests to inject an in-memory/direct SQL database client
 */
export function setTestDatabaseClient(client: any) {
  mockDbClient = client;
}

export function getTestDatabaseClient() {
  return mockDbClient;
}

/**
 * Returns a Supabase client configured with the service role key for trusted server operations
 */
export function getServiceSupabaseClient(env: Env): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server database operations.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Returns a Supabase client scoped to an authenticated user's access token
 */
export function getUserSupabaseClient(env: Env, accessToken: string): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
