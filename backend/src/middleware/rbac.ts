// ============================================================================
// File: backend/src/middleware/rbac.ts
// Description: Role-Based Access Control (RBAC) middleware
// ============================================================================

import type { Context, Next } from 'hono';
import type { AuthContextUser, UserRole, ApiResponse, Env } from '../types/index.js';
import { logAuditEvent } from '../services/audit.js';

export function requireRole(allowedRoles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthContextUser | undefined;
    const env = c.env as Env;
    const restaurantId = c.get('restaurantId') as string | undefined;

    if (!auth) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      };
      return c.json(response, 401);
    }

    if (!allowedRoles.includes(auth.role)) {
      // Security Audit Warning: Log privilege escalation attempt
      if (restaurantId || auth.restaurantId) {
        await logAuditEvent(env, {
          restaurantId: (restaurantId || auth.restaurantId)!,
          actor: auth,
          action: 'ACCESS_DENIED_ROLE_ESCALATION',
          targetEntity: 'API_ENDPOINT',
          targetId: c.req.path,
          details: {
            userRole: auth.role,
            requiredRoles: allowedRoles,
            method: c.req.method,
            path: c.req.path,
          },
        });
      }

      const response: ApiResponse = {
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${auth.role}`,
        },
      };
      return c.json(response, 403);
    }

    return await next();
  };
}

export const requireCustomer = () => requireRole(['CUSTOMER']);
export const requireStaff = () => requireRole(['STAFF', 'MANAGER', 'OWNER']);
export const requireManagerOrOwner = () => requireRole(['MANAGER', 'OWNER']);
export const requireOwner = () => requireRole(['OWNER']);
