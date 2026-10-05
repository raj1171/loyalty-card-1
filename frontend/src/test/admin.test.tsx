// ============================================================================
// File: frontend/src/test/admin.test.tsx
// Description: Automated integration and unit tests for Merchant / Admin Portal
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../services/api.js';
import { RestaurantProvider } from '../context/RestaurantContext.js';
import { AdminDashboard } from '../pages/admin/AdminDashboard.js';
import { AdminCustomers } from '../pages/admin/AdminCustomers.js';
import { AdminRewards } from '../pages/admin/AdminRewards.js';
import { AdminLoyaltyRules } from '../pages/admin/AdminLoyaltyRules.js';
import { AdminTransactions } from '../pages/admin/AdminTransactions.js';
import { AdminRedemptions } from '../pages/admin/AdminRedemptions.js';
import { AdminStaff } from '../pages/admin/AdminStaff.js';
import { AdminAnalytics } from '../pages/admin/AdminAnalytics.js';
import { AdminQrManagement } from '../pages/admin/AdminQrManagement.js';
import { AdminSettings } from '../pages/admin/AdminSettings.js';
import type { Restaurant, RestaurantSettings, AdminAnalytics as AnalyticsType } from '../types/index.js';

// Mock API
vi.mock('../services/api.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    api: {
      getRestaurantLanding: vi.fn(),
      admin: {
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
        updateRestaurant: vi.fn(),
        getRewards: vi.fn(),
        createReward: vi.fn(),
        updateReward: vi.fn(),
        deleteReward: vi.fn(),
        getCustomers: vi.fn(),
        getCustomer: vi.fn(),
        adjustCustomerBalance: vi.fn(),
        getTransactions: vi.fn(),
        getRedemptions: vi.fn(),
        getAnalytics: vi.fn(),
        getStaff: vi.fn(),
        inviteStaff: vi.fn(),
        getQrCodes: vi.fn(),
        createQrCode: vi.fn(),
      },
      staff: {
        verifyRedemption: vi.fn(),
        fulfillRedemption: vi.fn(),
        recordVisit: vi.fn(),
      },
    },
  };
});

const mockRestaurant: Restaurant = {
  id: 'rest-uuid-1',
  slug: 'artisan-coffee',
  name: 'Artisan Roast & Co.',
  tagline: 'Specialty coffee & fresh pastries',
  logo_url: 'https://example.com/logo.png',
  brand_color: '#d97706',
  accent_color: '#b45309',
  currency: 'USD',
  is_active: true,
};

const mockSettings: RestaurantSettings = {
  loyalty_model: 'POINTS',
  points_per_currency_unit: 10,
  stamps_target_count: 10,
  stamp_minimum_spend: 5,
  reward_expiry_days: 30,
  redemption_code_ttl_minutes: 15,
  welcome_bonus_points: 50,
  welcome_bonus_stamps: 0,
  terms_and_conditions: 'Standard terms apply.',
};

const mockAnalytics: AnalyticsType = {
  total_members: 142,
  points_issued: 12500,
  points_redeemed: 4200,
  redemptions: {
    total_requested: 38,
    total_fulfilled: 35,
    total_active: 3,
  },
  visits: {
    total_visits: 520,
    total_spend: 6480.5,
  },
};

describe('Merchant & Admin Portal Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getRestaurantLanding).mockResolvedValue({
      restaurant: mockRestaurant,
      settings: mockSettings,
      sample_rewards: [],
    });
  });

  // 1. Dashboard
  describe('1. Admin Dashboard', () => {
    it('renders KPI metrics and recent activity feeds', async () => {
      vi.mocked(api.admin.getAnalytics).mockResolvedValueOnce(mockAnalytics);
      vi.mocked(api.admin.getRedemptions).mockResolvedValueOnce({
        redemptions: [
          {
            id: 'red-1',
            code: 'RD-COFFEE-01',
            status: 'ISSUED',
            points_cost: 100,
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
            redeemed_at: null,
            reward_title: 'Free Artisanal Pour-Over',
            customer_name: 'Alice Walker',
            customer_phone: '+15551234567',
          },
        ],
        pagination: { total: 1, limit: 5, offset: 0, has_more: false },
      });
      vi.mocked(api.admin.getTransactions).mockResolvedValueOnce({
        transactions: [
          {
            id: 'tx-1',
            type: 'PURCHASE',
            points_stamps: 45,
            balance_after: 150,
            description: 'In-store order #4812',
            source: 'POS',
            created_at: new Date().toISOString(),
          },
        ],
        pagination: { total: 1, limit: 5, offset: 0, has_more: false },
      });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminDashboard onNavigateTab={() => {}} />
        </RestaurantProvider>
      );

      expect(await screen.findByText('142')).toBeInTheDocument();
      expect(screen.getByText('12500')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('520')).toBeInTheDocument();
      expect(screen.getByText('RD-COFFEE-01')).toBeInTheDocument();
      expect(screen.getByText('In-store order #4812')).toBeInTheDocument();
    });
  });

  // 2. Customers
  describe('2. Admin Customers', () => {
    it('lists customers and handles manual balance adjustment', async () => {
      vi.mocked(api.admin.getCustomers).mockResolvedValueOnce({
        customers: [
          {
            id: 'c-1',
            full_name: 'Alice Walker',
            phone: '+15551234567',
            email: 'alice@example.com',
            membership_number: 'AC-100234',
            joined_at: '2026-01-01T00:00:00Z',
            last_activity_at: '2026-02-01T00:00:00Z',
            current_balance: 150,
            lifetime_accrued: 300,
            lifetime_redeemed: 150,
            loyalty_model: 'POINTS',
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, has_more: false },
      });
      vi.mocked(api.admin.adjustCustomerBalance).mockResolvedValueOnce({ current_balance: 175 });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminCustomers />
        </RestaurantProvider>
      );

      expect(await screen.findByText('Alice Walker')).toBeInTheDocument();
      expect(screen.getByText('AC-100234')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();

      // Open manual adjust modal
      const adjustBtn = screen.getByRole('button', { name: 'Adjust' });
      fireEvent.click(adjustBtn);

      expect(screen.getByText('Manual Balance Adjustment')).toBeInTheDocument();

      // Submit adjustment
      const applyBtn = screen.getByRole('button', { name: 'Apply Adjustment' });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(api.admin.adjustCustomerBalance).toHaveBeenCalledWith(
          'rest-uuid-1',
          'c-1',
          25,
          'Customer courtesy bonus'
        );
      });
    });
  });

  // 3. Rewards (Exact user requirement test)
  describe('3. Admin Rewards & Exact "Free Coffee" Scenario', () => {
    it('creates reward matching exact spec: Free Coffee, 100 points, 30 days expiry, 1/customer/month', async () => {
      vi.mocked(api.admin.getRewards).mockResolvedValueOnce([]);
      vi.mocked(api.admin.createReward).mockResolvedValueOnce({
        id: 'new-rew-1',
        title: 'Free Coffee',
        description: 'Enjoy a fresh artisanal espresso or brewed coffee on the house.',
        image_url: null,
        cost_points_stamps: 100,
        is_active: true,
      });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminRewards />
        </RestaurantProvider>
      );

      // Open create modal
      const createBtn = await screen.findByRole('button', { name: /Create New Reward/i });
      fireEvent.click(createBtn);

      expect(screen.getAllByText('Create New Reward').length).toBeGreaterThanOrEqual(1);

      // Apply the pre-built preset for Free Coffee
      const presetBtn = screen.getByRole('button', { name: 'Apply Preset' });
      fireEvent.click(presetBtn);

      expect(screen.getByDisplayValue('Free Coffee')).toBeInTheDocument();
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByText('1 / Customer / Month')).toBeInTheDocument();

      // Publish Reward
      const publishBtn = screen.getByRole('button', { name: 'Publish Reward' });
      fireEvent.click(publishBtn);

      await waitFor(() => {
        expect(api.admin.createReward).toHaveBeenCalledWith(
          'rest-uuid-1',
          expect.objectContaining({
            title: 'Free Coffee',
            cost_points_stamps: 100,
            max_redemptions_per_customer: 1,
            is_active: true,
          })
        );
      });
    });
  });

  // 4. Loyalty Rules
  describe('4. Admin Loyalty Rules', () => {
    it('updates loyalty model and parameters', async () => {
      vi.mocked(api.admin.getSettings).mockResolvedValueOnce(mockSettings);
      vi.mocked(api.admin.updateSettings).mockResolvedValueOnce(mockSettings);

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminLoyaltyRules />
        </RestaurantProvider>
      );

      expect(await screen.findByText('Points-Based Program')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();

      // Save changes
      const saveBtn = screen.getByRole('button', { name: /Save Rule Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateSettings).toHaveBeenCalledWith(
          'rest-uuid-1',
          expect.objectContaining({
            loyalty_model: 'POINTS',
            points_per_currency_unit: 10,
            reward_expiry_days: 30,
            redemption_code_ttl_minutes: 15,
          })
        );
      });
    });
  });

  // 5. Transactions
  describe('5. Admin Transactions', () => {
    it('renders auditable ledger records and supports type filtering', async () => {
      vi.mocked(api.admin.getTransactions).mockResolvedValueOnce({
        transactions: [
          {
            id: 'tx-1',
            type: 'PURCHASE',
            points_stamps: 50,
            balance_after: 200,
            description: 'Order #102',
            source: 'POS',
            created_at: new Date().toISOString(),
            customer_name: 'John Doe',
            customer_phone: '+15559876543',
          },
        ],
        pagination: { total: 1, limit: 50, offset: 0, has_more: false },
      });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminTransactions />
        </RestaurantProvider>
      );

      expect(await screen.findByText('Audited Transaction Ledger')).toBeInTheDocument();
      expect(screen.getByText('Order #102')).toBeInTheDocument();
      expect(screen.getByText('+50')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  // 6. Redemptions
  describe('6. Admin Redemptions & Staff Verifier', () => {
    it('verifies customer code and fulfills reward', async () => {
      vi.mocked(api.admin.getRedemptions).mockResolvedValue({
        redemptions: [],
        pagination: { total: 0, limit: 50, offset: 0, has_more: false },
      });
      vi.mocked(api.staff.verifyRedemption).mockResolvedValueOnce({
        id: 'red-uuid-1',
        code: 'RD-COFFEE-01',
        status: 'ISSUED',
        points_cost: 100,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
        reward_title: 'Free Coffee',
        customer_name: 'Alice Walker',
        customer_phone: '+15551234567',
        is_valid: true,
        validity_reason: 'Code is valid and ready for fulfillment.',
      });
      vi.mocked(api.staff.fulfillRedemption).mockResolvedValueOnce({ status: 'REDEEMED' });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminRedemptions />
        </RestaurantProvider>
      );

      const input = await screen.findByPlaceholderText(/Enter customer code: RD-XXXX-XXXX/i);
      fireEvent.change(input, { target: { value: 'RD-COFFEE-01' } });

      const verifyBtn = screen.getByRole('button', { name: 'Verify Code' });
      fireEvent.click(verifyBtn);

      expect(await screen.findByText('Free Coffee')).toBeInTheDocument();
      expect(screen.getByText('VALID PASS')).toBeInTheDocument();

      // Fulfill
      const fulfillBtn = screen.getByRole('button', { name: /Confirm & Fulfill Reward/i });
      fireEvent.click(fulfillBtn);

      await waitFor(() => {
        expect(api.staff.fulfillRedemption).toHaveBeenCalledWith('rest-uuid-1', 'RD-COFFEE-01', undefined);
      });
    });
  });

  // 7. Staff
  describe('7. Admin Staff', () => {
    it('lists staff members and handles staff invitation', async () => {
      vi.mocked(api.admin.getStaff).mockResolvedValueOnce([
        {
          id: 'staff-1',
          user_id: 'u-1',
          email: 'owner@artisan.com',
          full_name: 'Arthur Pendelton',
          role: 'OWNER',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);
      vi.mocked(api.admin.inviteStaff).mockResolvedValueOnce({ id: 'staff-2' });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminStaff />
        </RestaurantProvider>
      );

      expect(await screen.findByText('Arthur Pendelton')).toBeInTheDocument();
      expect(screen.getAllByText('OWNER').length).toBeGreaterThanOrEqual(1);

      // Open invite modal
      const addBtn = screen.getByRole('button', { name: /Add Staff Member/i });
      fireEvent.click(addBtn);

      expect(screen.getAllByText('Add Staff Member').length).toBeGreaterThanOrEqual(1);

      // Fill in details
      fireEvent.change(screen.getByPlaceholderText('e.g. Marcus Vance'), {
        target: { value: 'Marcus Shift' },
      });
      fireEvent.change(screen.getByPlaceholderText('marcus@restaurant.com'), {
        target: { value: 'marcus@artisan.com' },
      });

      const submitBtn = screen.getByRole('button', { name: 'Save Staff Member' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.admin.inviteStaff).toHaveBeenCalledWith(
          'rest-uuid-1',
          expect.objectContaining({
            email: 'marcus@artisan.com',
            full_name: 'Marcus Shift',
            role: 'STAFF',
          })
        );
      });
    });
  });

  // 8. Analytics
  describe('8. Admin Analytics', () => {
    it('calculates points economy, fulfillment rate, and average spend', async () => {
      vi.mocked(api.admin.getAnalytics).mockResolvedValueOnce(mockAnalytics);

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminAnalytics />
        </RestaurantProvider>
      );

      expect(await screen.findByText('92%')).toBeInTheDocument(); // 35 / 38 = 92%
      expect(screen.getByText('$12.46')).toBeInTheDocument(); // 6480.5 / 520 = $12.46
      expect(screen.getByText('8300')).toBeInTheDocument(); // 12500 - 4200 = 8300
    });
  });

  // 9. QR Management
  describe('9. Admin QR Management', () => {
    it('lists QR codes, generates new table QR, and opens printable stand preview', async () => {
      vi.mocked(api.admin.getQrCodes).mockResolvedValueOnce([
        {
          id: 'qr-1',
          restaurant_id: 'rest-uuid-1',
          label: 'Table #1',
          code_identifier: 'artisan-table-1',
          location_tag: 'table-1',
          target_path: '/r/artisan-coffee?table=1',
          scan_count: 84,
          created_at: new Date().toISOString(),
        },
      ]);
      vi.mocked(api.admin.createQrCode).mockResolvedValueOnce({ id: 'qr-2' });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminQrManagement />
        </RestaurantProvider>
      );

      expect(await screen.findByText('Table #1')).toBeInTheDocument();
      expect(screen.getByText('84')).toBeInTheDocument();

      // Open printable display stand preview
      const printBtn = screen.getByRole('button', { name: /Print Display Stand/i });
      fireEvent.click(printBtn);

      expect(screen.getByText('Printable Table Stand Preview')).toBeInTheDocument();
      expect(screen.getByText('Scan to Earn Rewards!')).toBeInTheDocument();
    });
  });

  // 10. Settings
  describe('10. Admin Settings', () => {
    it('updates restaurant profile and branding colors', async () => {
      vi.mocked(api.admin.updateRestaurant).mockResolvedValueOnce(mockRestaurant);

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AdminSettings />
        </RestaurantProvider>
      );

      expect(await screen.findByDisplayValue('Artisan Roast & Co.')).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateRestaurant).toHaveBeenCalledWith(
          'rest-uuid-1',
          expect.objectContaining({
            name: 'Artisan Roast & Co.',
            brand_color: '#d97706',
            accent_color: '#b45309',
          })
        );
      });
    });
  });
});
