// ============================================================================
// File: frontend/src/types/index.ts
// Description: Frontend data models matching the Cloudflare Workers API
// ============================================================================

export type LoyaltyModel = 'POINTS' | 'STAMPS';

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description?: string | null;
  address?: string | null;
  phone_contact?: string | null;
  logo_url: string | null;
  brand_color: string;
  accent_color: string;
  currency: string;
  is_active: boolean;
}

export interface RestaurantSettings {
  loyalty_model: LoyaltyModel;
  points_per_currency_unit: number;
  stamps_target_count: number;
  stamp_minimum_spend: number;
  reward_expiry_days: number;
  redemption_code_ttl_minutes: number;
  welcome_bonus_points: number;
  welcome_bonus_stamps: number;
  instagram_url?: string | null;
  facebook_url?: string | null;
  google_review_url?: string | null;
  website_url?: string | null;
  terms_and_conditions: string | null;
}

export interface CustomerProfile {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  birthday: string | null;
  created_at: string;
}

export interface CustomerMembership {
  id: string;
  restaurant_id: string;
  customer_id: string;
  membership_number: string;
  joined_at: string;
  last_activity_at: string;
  is_active: boolean;
}

export interface LoyaltyAccount {
  id: string;
  restaurant_id: string;
  customer_id: string;
  loyalty_model: LoyaltyModel;
  current_balance: number;
  lifetime_accrued: number;
  lifetime_redeemed: number;
  version: number;
  updated_at: string;
}

export interface Reward {
  id: string;
  restaurant_id?: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points_stamps: number;
  is_active?: boolean;
  is_eligible?: boolean;
}

export interface ActiveRedemption {
  id: string;
  code: string;
  status: 'AVAILABLE' | 'REQUESTED' | 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  points_cost: number;
  issued_at: string;
  expires_at: string;
  reward_title: string;
}

export interface LoyaltyTransaction {
  id: string;
  type: string;
  points_stamps: number;
  balance_after: number;
  description: string;
  source: string;
  created_at: string;
}

export type StampClaimStatus = 'CREATED' | 'DISPLAYED' | 'VERIFIED' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface StampClaim {
  id: string;
  code: string;
  status: StampClaimStatus;
  expires_at: string;
  created_at?: string;
  is_existing?: boolean;
}

export interface CashierStampVerifyResult {
  claim_id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  current_stamps: number;
  target_stamps: number;
  expires_at: string;
  eligible: boolean;
}

export interface CashierStampConsumeResult {
  customer_id: string;
  customer_name: string;
  previous_stamps: number;
  new_stamps: number;
  target_stamps: number;
  reward_unlocked: boolean;
  transaction_id: string;
}

export interface DashboardData {
  restaurant?: (Restaurant & RestaurantSettings) | null;
  membership: CustomerMembership;
  loyalty_account: LoyaltyAccount;
  recent_transactions: LoyaltyTransaction[];
  active_redemptions: ActiveRedemption[];
  available_rewards: Reward[];
  active_stamp_claim?: StampClaim | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

export interface AdminAnalytics {
  total_members: number;
  points_issued: number;
  points_redeemed: number;
  redemptions: {
    total_requested: number;
    total_fulfilled: number;
    total_active: number;
  };
  visits: {
    total_visits: number;
    total_spend: number;
  };
}

export interface StaffMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'STAFF' | 'MANAGER' | 'OWNER';
  is_active: boolean;
  created_at: string;
}

export interface QrCodeItem {
  id: string;
  restaurant_id: string;
  label: string;
  code_identifier: string;
  location_tag: string | null;
  target_path: string;
  scan_count: number;
  created_at: string;
}

export interface AdminCustomer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  membership_number: string;
  joined_at: string;
  last_activity_at: string;
  current_balance: number;
  lifetime_accrued: number;
  lifetime_redeemed: number;
  loyalty_model: LoyaltyModel;
}

export interface AdminCustomerDetail extends AdminCustomer {
  birthday?: string | null;
  recent_transactions: LoyaltyTransaction[];
}

export interface AdminRedemption {
  id: string;
  code: string;
  status: 'AVAILABLE' | 'REQUESTED' | 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  points_cost: number;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  reward_title: string;
  customer_name: string | null;
  customer_phone: string;
}

export interface CreateRewardPayload {
  title: string;
  description?: string;
  image_url?: string;
  cost_points_stamps: number;
  is_active?: boolean;
  max_redemptions_per_customer?: number | null;
  total_inventory?: number | null;
  valid_from?: string;
  valid_until?: string | null;
}
