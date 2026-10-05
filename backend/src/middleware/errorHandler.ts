// ============================================================================
// File: backend/src/middleware/errorHandler.ts
// Description: Global error handler formatting all API responses uniformly
// ============================================================================

import type { Context } from 'hono';
import { ZodError } from 'zod';
import type { ApiResponse } from '../types/index.js';

export function errorHandler(err: Error, c: Context): Response {
  console.error('[API Error]', err);

  // 1. Zod Validation Error (HTTP 400)
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    const response: ApiResponse = {
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: formattedErrors,
      },
    };
    return c.json(response, 400);
  }

  // 2. Custom App Error with status codes
  const message = err.message || 'Internal Server Error';

  if (message.includes('Unauthorized') || message.includes('Authentication required')) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    };
    return c.json(response, 401);
  }

  if (message.includes('Forbidden') || message.includes('Access denied') || message.includes('Tenant mismatch')) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message,
      },
    };
    return c.json(response, 403);
  }

  if (message.includes('not found') || message.includes('Not Found')) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message,
      },
    };
    return c.json(response, 404);
  }

  if (message.includes('Insufficient balance') || message.includes('already been redeemed') || message.includes('expired') || message.includes('exhausted') || message.includes('limit reached')) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: {
        code: 'CONFLICT',
        message,
      },
    };
    return c.json(response, 409);
  }

  // 3. Fallback General Server Error (HTTP 500)
  const response: ApiResponse = {
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred',
    },
  };
  return c.json(response, 500);
}
