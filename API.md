# REST API Specification — Cloudflare Workers Backend

This document specifies the REST API endpoints, authorization rules, request/response contracts, and security standards for the Multi-Tenant Digital Loyalty Platform backend running on Cloudflare Workers.

---

## 1. Architectural & Security Rules

1. **Server-Side Derivation**:
   - `customer_id` is **never** accepted from frontend inputs. It is derived server-side from the authenticated JWT session.
   - `points` / `stamps` balances and reward eligibility are calculated strictly server-side from the database ledger. Frontend values are ignored.
   - User `role` is derived from verified database records (`customers` or `restaurant_staff`), never from frontend claims.
2. **Multi-Tenant Scoping**:
   - Staff/Manager/Owner requests are verified against their assigned `restaurant_id`. Any attempt to query or manipulate a different restaurant's data is rejected with `403 Forbidden` ("Tenant mismatch").
3. **Idempotency**:
   - Balance-altering and redemption endpoints require or accept the `Idempotency-Key` HTTP header. Replay requests with the same key return the existing record without double-deduction.
4. **Rate Limiting**:
   - Edge sliding-window rate limiting is enforced on sensitive endpoints (e.g. OTP requests: 5/10min, redemption: 10/min, general API: 100/min). Exceeded limits return `429 Too Many Requests`.

---

## 2. Standard Envelope & Error Structure

All endpoints return a uniform JSON envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}
```

### Standard Error Codes
| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Request payload failed Zod schema validation |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired session token |
| `403` | `FORBIDDEN` | Insufficient role permissions or tenant mismatch |
| `404` | `NOT_FOUND` | Restaurant, reward, or redemption code not found |
| `409` | `CONFLICT` / `ALREADY_REDEEMED` / `INSUFFICIENT_BALANCE` | State machine violation or insufficient balance |
| `429` | `TOO_MANY_REQUESTS` | Rate limit threshold exceeded |
| `500` | `INTERNAL_ERROR` | Unexpected internal server error |

---

## 3. Public Endpoints (Unauthenticated / Edge-Cached)

### `GET /api/r/:slug`
Resolves restaurant branding, loyalty model, rules, and sample rewards for QR landing pages. Edge-cached.

- **URL Parameter**: `slug` (string, e.g., `artisan-coffee`)
- **Headers**: None
- **Response `data`**:
  ```json
  {
    "restaurant": {
      "id": "11111111-1111-1111-1111-111111111111",
      "slug": "artisan-coffee",
      "name": "The Artisan Coffee Roasters",
      "tagline": "Specialty single-origin coffees & fresh pastries",
      "brand_color": "#D97706",
      "accent_color": "#B45309",
      "currency": "USD"
    },
    "settings": {
      "loyalty_model": "POINTS",
      "points_per_currency_unit": 10.00,
      "stamps_target_count": 10,
      "stamp_minimum_spend": 0.00,
      "reward_expiry_days": 30,
      "redemption_code_ttl_minutes": 20,
      "welcome_bonus_points": 25,
      "welcome_bonus_stamps": 0
    },
    "sample_rewards": [
      {
        "id": "...",
        "title": "Free Specialty Latte",
        "description": "Any large espresso-based latte",
        "cost_points_stamps": 50
      }
    ]
  }
  ```

---

## 4. Authentication Endpoints

### `POST /api/auth/otp/send`
Request an SMS verification code for mobile authentication.

- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "phone": "+15551000001",
    "turnstile_token": "optional-cloudflare-token"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "phone": "+15551000001",
      "message": "OTP sent successfully via SMS.",
      "ttl_seconds": 600
    },
    "error": null
  }
  ```

### `POST /api/auth/otp/verify`
Verify SMS code and initialize session. Automatically creates customer restaurant membership and credits welcome bonus if `restaurant_id` is supplied.

- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "phone": "+15551000001",
    "code": "123456",
    "restaurant_id": "11111111-1111-1111-1111-111111111111",
    "full_name": "Alice Walker"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "session_token": "ey...",
      "user_id": "c1111111-1111-1111-1111-111111111111",
      "phone": "+15551000001",
      "membership": {
        "membership_number": "M-ART1-0001",
        "initial_balance": 25
      }
    },
    "error": null
  }
  ```

---

## 5. Customer Loyalty Endpoints

All customer endpoints require `Authorization: Bearer <session_token>` and role `CUSTOMER`.

### `GET /api/me`
Retrieve authenticated customer identity.

### `PATCH /api/me`
Update profile info (`full_name`, `email`, `birthday`).

### `GET /api/me/dashboard?restaurant_id=:id`
High-speed consolidated mobile dashboard payload.
- **Query Parameter**: `restaurant_id` (UUID)
- **Response `data`**:
  ```json
  {
    "membership": {
      "membership_number": "M-ART1-0001",
      "joined_at": "...",
      "last_activity_at": "..."
    },
    "loyalty_account": {
      "loyalty_model": "POINTS",
      "current_balance": 120,
      "lifetime_accrued": 220,
      "lifetime_redeemed": 100
    },
    "recent_transactions": [
      {
        "id": "...",
        "type": "PURCHASE",
        "points_stamps": 195,
        "balance_after": 220,
        "description": "Order #1042 - Cold brew & avocado toast",
        "created_at": "..."
      }
    ],
    "active_redemptions": [
      {
        "id": "...",
        "code": "RD-ART1-7788",
        "reward_title": "Free Specialty Latte",
        "points_cost": 50,
        "expires_at": "..."
      }
    ],
    "available_rewards": [
      {
        "id": "...",
        "title": "Free Specialty Latte",
        "cost_points_stamps": 50,
        "is_eligible": true
      }
    ]
  }
  ```

### `GET /api/me/transactions?restaurant_id=:id&limit=20&offset=0`
Paginated loyalty transaction ledger history.

### `GET /api/me/redemptions?restaurant_id=:id`
Active, unexpired redemption codes with countdown deadlines.

---

## 6. Rewards & Atomic Redemption

### `GET /api/rewards?restaurant_id=:id`
List active rewards. If authenticated as a customer, calculates `is_eligible` from server balance.

### `POST /api/rewards/:id/redeem?restaurant_id=:id`
Atomically redeems a reward.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <unique-client-nonce>`
- **Security Check**:
  - `customer_id` is derived from `auth.userId`.
  - Points cost is verified from database row lock (`FOR UPDATE`).
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ISSUED",
      "redemption_id": "...",
      "code": "RD-ART1-9922",
      "expires_at": "2026-10-04T12:30:00Z",
      "points_cost": 50,
      "remaining_balance": 70,
      "is_idempotent_replay": false
    },
    "error": null
  }
  ```

---

## 7. Staff In-Store Operations

Requires `Authorization: Bearer <token>` and role `STAFF`, `MANAGER`, or `OWNER`.

### `POST /api/staff/redemptions/verify`
Preview customer redemption code details and verify authenticity.
- **Body**: `{ "code": "RD-ART1-9922" }`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "code": "RD-ART1-9922",
      "is_valid": true,
      "validity_reason": "Code is valid and ready for fulfillment.",
      "reward_title": "Free Specialty Latte",
      "customer_name": "Alice Walker",
      "customer_phone": "+15551000001",
      "expires_at": "..."
    }
  }
  ```

### `POST /api/staff/redemptions/fulfill`
Single-use fulfillment. Transitions state from `ISSUED` $\rightarrow$ `REDEEMED`.
- **Body**: `{ "code": "RD-ART1-9922", "notes": "Counter Register #1" }`
- **Replay Protection**: Attempting to fulfill an already redeemed code returns `409 Conflict`.

### `POST /api/staff/visits/record`
Record in-store visit/purchase. Calculates points or stamps server-side based on restaurant rules.
- **Body**:
  ```json
  {
    "customer_phone": "+15551000001",
    "spend_amount": 15.50,
    "notes": "Dine-in pastry order"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "visit_id": "...",
      "points_or_stamps_earned": 155,
      "new_balance": 225,
      "loyalty_model": "POINTS"
    }
  }
  ```

---

## 8. Restaurant Admin & Management

Requires `Authorization: Bearer <token>` and role `MANAGER` or `OWNER`.

### Settings
- `GET /api/admin/settings`: View loyalty configuration.
- `PATCH /api/admin/settings`: Update rates, model, or thresholds.

### Rewards Management
- `GET /api/admin/rewards`: List all rewards (active and drafts).
- `POST /api/admin/rewards`: Create reward (`title`, `cost_points_stamps`, `inventory`).
- `PATCH /api/admin/rewards/:id`: Update reward.
- `DELETE /api/admin/rewards/:id`: Soft-delete/deactivate reward.

### Customers & Ledger
- `GET /api/admin/customers?search=alice&limit=20`: Customer list with balance and activity.
- `GET /api/admin/transactions`: Full auditable transaction log.

### Analytics & Reports
- `GET /api/admin/analytics`: Aggregated member metrics, points issued vs redeemed, redemption status counts.

### Staff & QR Codes
- `GET /api/admin/staff` & `POST /api/admin/staff/invite`: (Owner role required)
- `GET /api/admin/qr-codes` & `POST /api/admin/qr-codes`: Create counter/table QR routes.
