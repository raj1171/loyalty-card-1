// ============================================================================
// File: frontend/src/services/api.ts
// Description: Typed HTTP client for the Cloudflare Workers REST API
// ============================================================================

import type {
  ApiResponse,
  Restaurant,
  RestaurantSettings,
  Reward,
  DashboardData,
  CustomerProfile,
  ActiveRedemption,
  LoyaltyTransaction,
} from '../types/index.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getAuthToken(): string | null {
  return localStorage.getItem('loyalty_session_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('loyalty_session_token', token);
  } else {
    localStorage.removeItem('loyalty_session_token');
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || `HTTP ${res.status}: Request failed`;
    const error = new Error(errorMsg) as Error & { code?: string; details?: unknown };
    error.code = json.error?.code || 'UNKNOWN_ERROR';
    error.details = json.error?.details;
    throw error;
  }

  return json.data as T;
}

export const api = {
  // Public
  async getRestaurantLanding(slug: string): Promise<{
    restaurant: Restaurant;
    settings: RestaurantSettings;
    sample_rewards: Reward[];
  }> {
    return request<{
      restaurant: Restaurant;
      settings: RestaurantSettings;
      sample_rewards: Reward[];
    }>(`/api/r/${encodeURIComponent(slug)}`);
  },

  // Auth
  async sendOtp(phone: string, turnstile_token?: string): Promise<{ phone: string; message: string; ttl_seconds: number }> {
    return request('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, turnstile_token }),
    });
  },

  async verifyOtp(
    phone: string,
    code: string,
    restaurant_id?: string,
    full_name?: string
  ): Promise<{
    session_token: string;
    user_id: string;
    phone: string;
    membership?: any;
  }> {
    return request('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, restaurant_id, full_name }),
    });
  },

  // Customer Profile
  async getProfile(): Promise<CustomerProfile> {
    return request<CustomerProfile>('/api/me');
  },

  async updateProfile(data: { full_name?: string; email?: string; birthday?: string }): Promise<CustomerProfile> {
    return request<CustomerProfile>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Consolidated Mobile Dashboard
  async getDashboard(restaurantId: string): Promise<DashboardData> {
    return request<DashboardData>(`/api/me/dashboard?restaurant_id=${encodeURIComponent(restaurantId)}`);
  },

  // Rewards
  async getRewards(restaurantId: string): Promise<{ current_balance: number; rewards: Reward[] }> {
    return request<{ current_balance: number; rewards: Reward[] }>(
      `/api/rewards?restaurant_id=${encodeURIComponent(restaurantId)}`
    );
  },

  async redeemReward(
    rewardId: string,
    restaurantId: string,
    idempotencyKey?: string
  ): Promise<{
    status: string;
    redemption_id: string;
    code: string;
    expires_at: string;
    points_cost: number;
    remaining_balance: number;
    is_idempotent_replay: boolean;
  }> {
    return request(
      `/api/rewards/${encodeURIComponent(rewardId)}/redeem?restaurant_id=${encodeURIComponent(restaurantId)}`,
      {
        method: 'POST',
        idempotencyKey: idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }
    );
  },

  // Transactions
  async getTransactions(
    restaurantId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    transactions: LoyaltyTransaction[];
    pagination: { total: number; limit: number; offset: number; has_more: boolean };
  }> {
    return request(
      `/api/me/transactions?restaurant_id=${encodeURIComponent(restaurantId)}&limit=${limit}&offset=${offset}`
    );
  },

  // Active Redemptions
  async getActiveRedemptions(restaurantId: string): Promise<ActiveRedemption[]> {
    return request<ActiveRedemption[]>(
      `/api/me/redemptions?restaurant_id=${encodeURIComponent(restaurantId)}`
    );
  },

  // Stamp Claims (One-time customer code for cashier)
  async createStampClaim(restaurantId: string): Promise<{
    claim_id: string;
    code: string;
    expires_at: string;
    status: string;
    is_existing: boolean;
  }> {
    return request(
      `/api/me/stamp-claim/create?restaurant_id=${encodeURIComponent(restaurantId)}`,
      { method: 'POST' }
    );
  },

  async getActiveStampClaim(restaurantId: string): Promise<{
    id: string;
    code: string;
    status: string;
    expires_at: string;
    created_at: string;
  } | null> {
    return request(
      `/api/me/stamp-claim/active?restaurant_id=${encodeURIComponent(restaurantId)}`
    );
  },

  // --------------------------------------------------------------------------
  // Admin & Merchant Operations
  // --------------------------------------------------------------------------
  admin: {
    async getSettings(restaurantId: string): Promise<RestaurantSettings> {
      return request<RestaurantSettings>('/api/admin/settings', {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async updateSettings(restaurantId: string, settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
      return request<RestaurantSettings>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(settings),
      });
    },

    async updateRestaurant(
      restaurantId: string,
      data: { name?: string; tagline?: string | null; logo_url?: string | null; brand_color?: string; accent_color?: string; currency?: string }
    ): Promise<Restaurant> {
      return request<Restaurant>('/api/admin/restaurant', {
        method: 'PATCH',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(data),
      });
    },

    async getRewards(restaurantId: string): Promise<Reward[]> {
      return request<Reward[]>('/api/admin/rewards', {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async createReward(restaurantId: string, payload: any): Promise<Reward> {
      return request<Reward>('/api/admin/rewards', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(payload),
      });
    },

    async updateReward(restaurantId: string, rewardId: string, payload: any): Promise<Reward> {
      return request<Reward>(`/api/admin/rewards/${encodeURIComponent(rewardId)}`, {
        method: 'PATCH',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(payload),
      });
    },

    async deleteReward(restaurantId: string, rewardId: string): Promise<{ message: string }> {
      return request<{ message: string }>(`/api/admin/rewards/${encodeURIComponent(rewardId)}`, {
        method: 'DELETE',
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async getCustomers(
      restaurantId: string,
      search = '',
      limit = 20,
      offset = 0
    ): Promise<{ customers: any[]; pagination: { total: number; limit: number; offset: number; has_more: boolean } }> {
      return request(
        `/api/admin/customers?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`,
        { headers: { 'X-Restaurant-Id': restaurantId } }
      );
    },

    async getCustomer(restaurantId: string, customerId: string): Promise<any> {
      return request(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async adjustCustomerBalance(
      restaurantId: string,
      customerId: string,
      points_stamps: number,
      reason: string
    ): Promise<{ current_balance: number }> {
      return request(`/api/admin/customers/${encodeURIComponent(customerId)}/adjust`, {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify({ points_stamps, reason }),
      });
    },

    async getTransactions(
      restaurantId: string,
      limit = 50,
      offset = 0
    ): Promise<{ transactions: any[]; pagination: { total: number; limit: number; offset: number; has_more: boolean } }> {
      return request(`/api/admin/transactions?limit=${limit}&offset=${offset}`, {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async getRedemptions(
      restaurantId: string,
      status?: string,
      limit = 50,
      offset = 0
    ): Promise<{ redemptions: any[]; pagination: { total: number; limit: number; offset: number; has_more: boolean } }> {
      const q = status ? `&status=${encodeURIComponent(status)}` : '';
      return request(`/api/admin/redemptions?limit=${limit}&offset=${offset}${q}`, {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async getAnalytics(restaurantId: string): Promise<any> {
      return request('/api/admin/analytics', {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async getStaff(restaurantId: string): Promise<any[]> {
      return request<any[]>('/api/admin/staff', {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async inviteStaff(restaurantId: string, payload: { user_id: string; email: string; full_name: string; role: string }): Promise<any> {
      return request('/api/admin/staff/invite', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(payload),
      });
    },

    async getQrCodes(restaurantId: string): Promise<any[]> {
      return request<any[]>('/api/admin/qr-codes', {
        headers: { 'X-Restaurant-Id': restaurantId },
      });
    },

    async createQrCode(restaurantId: string, payload: { label: string; code_identifier: string; location_tag?: string; target_path: string }): Promise<any> {
      return request('/api/admin/qr-codes', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(payload),
      });
    },
  },

  // --------------------------------------------------------------------------
  // Staff In-Store Verification & Actions
  // --------------------------------------------------------------------------
  staff: {
    async verifyRedemption(restaurantId: string, code: string): Promise<any> {
      return request('/api/staff/redemptions/verify', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify({ code }),
      });
    },

    async fulfillRedemption(restaurantId: string, code: string, notes?: string): Promise<any> {
      return request('/api/staff/redemptions/fulfill', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify({ code, notes }),
      });
    },

    async recordVisit(
      restaurantId: string,
      payload: { customer_phone?: string; customer_id?: string; spend_amount: number; notes?: string }
    ): Promise<any> {
      return request('/api/staff/visits/record', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify(payload),
      });
    },

    async verifyStampClaim(restaurantId: string, code: string): Promise<any> {
      return request('/api/staff/stamp-claims/verify', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify({ code }),
      });
    },

    async consumeStampClaim(restaurantId: string, code: string, notes?: string): Promise<any> {
      return request('/api/staff/stamp-claims/consume', {
        method: 'POST',
        headers: { 'X-Restaurant-Id': restaurantId },
        body: JSON.stringify({ code, notes }),
      });
    },
  },
};

