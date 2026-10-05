// ============================================================================
// File: backend/src/types/index.ts
// Description: Core type definitions for Multi-Tenant Digital Loyalty Platform
// ============================================================================

export type LoyaltyModel = 'POINTS' | 'STAMPS';

export type StaffRole = 'STAFF' | 'MANAGER' | 'OWNER';

export type UserRole = 'CUSTOMER' | StaffRole | 'SUPER_ADMIN';

export type TransactionType =
  | 'VISIT'
  | 'PURCHASE'
  | 'BONUS'
  | 'REFERRAL'
  | 'BIRTHDAY'
  | 'MANUAL_ADJUSTMENT'
  | 'REWARD_REDEMPTION'
  | 'REVERSAL';

export type RedemptionStatus =
  | 'AVAILABLE'
  | 'REQUESTED'
  | 'ISSUED'
  | 'REDEEMED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface AuthContextUser {
  userId: string;
  role: UserRole;
  phone?: string;
  email?: string;
  fullName?: string;
  customerId?: string; // Set when role === 'CUSTOMER'
  staffId?: string;    // Set when role is STAFF, MANAGER, or OWNER
  restaurantId?: string; // Associated tenant for staff
}

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
  created_at: string;
  updated_at: string;
}

export interface RestaurantSettings {
  restaurant_id: string;
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
  created_at: string;
  updated_at: string;
}

export type StampClaimStatus = 'CREATED' | 'DISPLAYED' | 'VERIFIED' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface StampClaim {
  id: string;
  restaurant_id: string;
  customer_id: string;
  code: string;
  status: StampClaimStatus;
  expires_at: string;
  verified_at: string | null;
  verified_by_staff_id: string | null;
  consumed_at: string | null;
  consumed_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantStaff {
  id: string;
  restaurant_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string | null;
  phone: string;
  email: string | null;
  full_name: string | null;
  birthday: string | null;
  created_at: string;
  updated_at: string;
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

export interface LoyaltyTransaction {
  id: string;
  restaurant_id: string;
  customer_id: string;
  loyalty_account_id: string;
  type: TransactionType;
  points_stamps: number;
  balance_after: number;
  reference_id: string | null;
  idempotency_key: string | null;
  description: string;
  source: string;
  created_by: string | null;
  audit_metadata: Record<string, unknown>;
  created_at: string;
}

export interface Reward {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points_stamps: number;
  is_active: boolean;
  max_redemptions_per_customer: number | null;
  total_inventory: number | null;
  claimed_inventory: number;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemption {
  id: string;
  restaurant_id: string;
  customer_id: string;
  reward_id: string;
  loyalty_transaction_id: string | null;
  code: string;
  status: RedemptionStatus;
  points_cost: number;
  idempotency_key: string | null;
  requested_at: string;
  issued_at: string | null;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by_staff_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  restaurant_id: string;
  customer_id: string;
  spend_amount: number;
  points_or_stamp_earned: number;
  recorded_by_staff_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface QRCode {
  id: string;
  restaurant_id: string;
  label: string;
  code_identifier: string;
  location_tag: string | null;
  target_path: string;
  scan_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  target_entity: string;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// Standard API Response Structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

// Cloudflare Workers Environment Bindings
export interface Env {
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

// Variables available in Hono context
export interface ContextVariables {
  auth?: AuthContextUser;
  restaurantId?: string;
  restaurant?: Restaurant;
  idempotencyKey?: string;
}
