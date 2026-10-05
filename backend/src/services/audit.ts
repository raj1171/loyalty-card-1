// ============================================================================
// File: backend/src/services/audit.ts
// Description: Centralized audit logging service for sensitive operations
// ============================================================================

import type { Env, AuthContextUser } from '../types/index.js';
import { getServiceSupabaseClient, getTestDatabaseClient } from './supabase.js';

export interface AuditLogParams {
  restaurantId: string;
  actor: AuthContextUser;
  action: string;
  targetEntity: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(env: Env, params: AuditLogParams): Promise<void> {
  const {
    restaurantId,
    actor,
    action,
    targetEntity,
    targetId,
    details = {},
    ipAddress,
    userAgent,
  } = params;

  try {
    const testDb = getTestDatabaseClient();
    if (testDb) {
      await testDb.query(
        `INSERT INTO audit_logs (
          restaurant_id, actor_id, actor_role, action, target_entity, target_id, ip_address, user_agent, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          restaurantId,
          actor.userId,
          actor.role,
          action,
          targetEntity,
          targetId || null,
          ipAddress || null,
          userAgent || null,
          JSON.stringify(details),
        ]
      );
      return;
    }

    const supabase = getServiceSupabaseClient(env);
    await supabase.from('audit_logs').insert({
      restaurant_id: restaurantId,
      actor_id: actor.userId,
      actor_role: actor.role,
      action,
      target_entity: targetEntity,
      target_id: targetId || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      details,
    });
  } catch (err) {
    // Non-fatal logging error: log to console to prevent blocking primary transactions
    console.error('Failed to write audit log:', err);
  }
}
