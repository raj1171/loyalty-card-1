// ============================================================================
// File: frontend/src/test/customer.test.tsx
// Description: Automated integration and unit tests for Customer Frontend
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, setAuthToken } from '../services/api.js';
import { RestaurantProvider } from '../context/RestaurantContext.js';
import { AuthProvider } from '../context/AuthContext.js';
import { QRLandingPage } from '../pages/QRLandingPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { DigitalLoyaltyCard } from '../components/customer/DigitalLoyaltyCard.js';
import { StampGrid } from '../components/customer/StampGrid.js';
import { RewardCard } from '../components/customer/RewardCard.js';
import { RewardDetailModal } from '../components/customer/RewardDetailModal.js';
import { RedemptionActiveModal } from '../components/customer/RedemptionActiveModal.js';
import { ProfileSheet } from '../components/customer/ProfileSheet.js';
import type { Restaurant, RestaurantSettings, DashboardData, CustomerProfile } from '../types/index.js';

// Mock API
vi.mock('../services/api.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    api: {
      getRestaurantLanding: vi.fn(),
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      getDashboard: vi.fn(),
      getRewards: vi.fn(),
      redeemReward: vi.fn(),
      getTransactions: vi.fn(),
      getActiveRedemptions: vi.fn(),
    },
  };
});

const mockRestaurantPoints: Restaurant = {
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

const mockSettingsPoints: RestaurantSettings = {
  loyalty_model: 'POINTS',
  points_per_currency_unit: 10,
  stamps_target_count: 10,
  stamp_minimum_spend: 5,
  reward_expiry_days: 90,
  redemption_code_ttl_minutes: 15,
  welcome_bonus_points: 50,
  welcome_bonus_stamps: 0,
  terms_and_conditions: 'Terms apply. Points expire after 90 days of inactivity.',
};

const mockProfile: CustomerProfile = {
  id: 'cust-uuid-1',
  phone: '+15551234567',
  full_name: 'Alice Cooper',
  email: 'alice@example.com',
  birthday: '1995-05-15',
  created_at: '2026-01-01T00:00:00Z',
};

const mockDashboardData: DashboardData = {
  membership: {
    id: 'mem-uuid-1',
    restaurant_id: 'rest-uuid-1',
    customer_id: 'cust-uuid-1',
    membership_number: 'AC-100234',
    joined_at: '2026-01-01T00:00:00Z',
    last_activity_at: '2026-02-01T00:00:00Z',
    is_active: true,
  },
  loyalty_account: {
    id: 'acc-uuid-1',
    restaurant_id: 'rest-uuid-1',
    customer_id: 'cust-uuid-1',
    loyalty_model: 'POINTS',
    current_balance: 150,
    lifetime_accrued: 350,
    lifetime_redeemed: 200,
    version: 4,
    updated_at: '2026-02-01T00:00:00Z',
  },
  recent_transactions: [
    {
      id: 'tx-1',
      type: 'PURCHASE',
      points_stamps: 45,
      balance_after: 150,
      description: 'In-store order #4812',
      source: 'POS',
      created_at: '2026-02-01T12:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'REWARD_REDEMPTION',
      points_stamps: -100,
      balance_after: 105,
      description: 'Redeemed Free Artisanal Pour-Over',
      source: 'APP',
      created_at: '2026-01-20T10:30:00Z',
    },
  ],
  active_redemptions: [],
  available_rewards: [
    {
      id: 'rew-1',
      title: 'Free Artisanal Pour-Over',
      description: 'Choice of single-origin beans brewed fresh.',
      image_url: null,
      cost_points_stamps: 100,
      is_eligible: true,
    },
    {
      id: 'rew-2',
      title: 'Specialty Lunch Panini',
      description: 'Prosciutto and buffalo mozzarella panini.',
      image_url: null,
      cost_points_stamps: 250,
      is_eligible: false,
    },
  ],
};

describe('Customer Frontend Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setAuthToken(null);
  });

  describe('1. Restaurant QR Landing Page & Branding', () => {
    it('renders restaurant name, tagline, and welcome bonus correctly', async () => {
      vi.mocked(api.getRestaurantLanding).mockResolvedValueOnce({
        restaurant: mockRestaurantPoints,
        settings: mockSettingsPoints,
        sample_rewards: [],
      });

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AuthProvider>
            <QRLandingPage onAuthenticated={() => {}} />
          </AuthProvider>
        </RestaurantProvider>
      );

      // Verify restaurant information appears
      expect(await screen.findByText('Artisan Roast & Co.')).toBeInTheDocument();
      expect(screen.getByText('Specialty coffee & fresh pastries')).toBeInTheDocument();
      expect(screen.getByText('Get 50 bonus points instantly!')).toBeInTheDocument();
      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('Join or Log In')).toBeInTheDocument();
    });

    it('renders error state when restaurant is not found', async () => {
      vi.mocked(api.getRestaurantLanding).mockRejectedValueOnce(new Error('Restaurant not found'));

      render(
        <RestaurantProvider initialSlug="invalid-slug">
          <AuthProvider>
            <QRLandingPage onAuthenticated={() => {}} />
          </AuthProvider>
        </RestaurantProvider>
      );

      expect(await screen.findByText('Restaurant Not Found')).toBeInTheDocument();
    });
  });

  describe('2. Join / Login Modal & Mobile Phone OTP Flow', () => {
    it('handles mobile phone OTP submission and verification flow', async () => {
      vi.mocked(api.getRestaurantLanding).mockResolvedValueOnce({
        restaurant: mockRestaurantPoints,
        settings: mockSettingsPoints,
        sample_rewards: [],
      });
      vi.mocked(api.sendOtp).mockResolvedValueOnce({
        phone: '+15551234567',
        message: 'OTP sent',
        ttl_seconds: 300,
      });
      vi.mocked(api.verifyOtp).mockResolvedValueOnce({
        session_token: 'valid-jwt-token',
        user_id: 'cust-uuid-1',
        phone: '+15551234567',
      });
      vi.mocked(api.getProfile).mockResolvedValueOnce(mockProfile);

      const onAuthSuccess = vi.fn();

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AuthProvider>
            <QRLandingPage onAuthenticated={onAuthSuccess} />
          </AuthProvider>
        </RestaurantProvider>
      );

      // Open login modal
      const joinBtn = await screen.findByText('Join or Log In');
      fireEvent.click(joinBtn);

      expect(screen.getByText('Join Loyalty Rewards')).toBeInTheDocument();

      // Enter phone
      const phoneInput = screen.getByPlaceholderText('+15551234567');
      fireEvent.change(phoneInput, { target: { value: '+15551234567' } });

      // Click Send Verification Code
      const sendOtpBtn = screen.getByText('Send Verification Code');
      fireEvent.click(sendOtpBtn);

      // Verify OTP screen transitions
      expect(await screen.findByText('Enter Verification Code')).toBeInTheDocument();
      expect(screen.getByText(/We sent a 6-digit code to/)).toBeInTheDocument();

      // Enter 6-digit OTP code into inputs
      const otpInputs = screen.getAllByRole('textbox');
      expect(otpInputs.length).toBe(6);
      fireEvent.change(otpInputs[0], { target: { value: '1' } });
      fireEvent.change(otpInputs[1], { target: { value: '2' } });
      fireEvent.change(otpInputs[2], { target: { value: '3' } });
      fireEvent.change(otpInputs[3], { target: { value: '4' } });
      fireEvent.change(otpInputs[4], { target: { value: '5' } });
      fireEvent.change(otpInputs[5], { target: { value: '6' } });

      // Submit verification
      const verifyBtn = screen.getByText('Verify & Continue');
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(api.verifyOtp).toHaveBeenCalledWith('+15551234567', '123456', 'rest-uuid-1', undefined);
      });
    });
  });

  describe('3. Digital Loyalty Card & Stamp Grid', () => {
    it('renders Points-based card balance and opens QR modal', async () => {
      render(
        <DigitalLoyaltyCard
          restaurant={mockRestaurantPoints}
          loyaltyAccount={mockDashboardData.loyalty_account}
          membership={mockDashboardData.membership}
        />
      );

      expect(screen.getByText('Artisan Roast & Co.')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Points')).toBeInTheDocument();
      expect(screen.getByText('AC-100234')).toBeInTheDocument();

      // Open QR modal
      const qrBtn = screen.getByLabelText('Show Membership QR Code');
      fireEvent.click(qrBtn);

      expect(screen.getByText('Your Loyalty Card QR')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('renders Stamps-based grid correctly with collected stamps', () => {
      render(<StampGrid currentStamps={4} targetStamps={10} />);

      expect(screen.getByText('4 of 10 Stamps')).toBeInTheDocument();
      expect(screen.getByText(/Collect 6 more stamps to unlock your next reward/)).toBeInTheDocument();
    });

    it('shows unlock banner when target stamps are achieved', () => {
      render(<StampGrid currentStamps={10} targetStamps={10} />);

      expect(screen.getByText(/Reward Unlocked! Choose a reward below to redeem/)).toBeInTheDocument();
    });
  });

  describe('4. Rewards List & Reward Details', () => {
    const mockSelect = vi.fn();

    it('renders eligible reward with ready-to-claim indicator', () => {
      render(
        <RewardCard
          reward={mockDashboardData.available_rewards[0]}
          loyaltyModel="POINTS"
          userBalance={150}
          onSelect={mockSelect}
        />
      );

      expect(screen.getByText('Free Artisanal Pour-Over')).toBeInTheDocument();
      expect(screen.getByText('100 pts')).toBeInTheDocument();
      expect(screen.getByText('Ready to claim')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Free Artisanal Pour-Over'));
      expect(mockSelect).toHaveBeenCalledWith(mockDashboardData.available_rewards[0]);
    });

    it('renders locked reward with remaining balance needed', () => {
      render(
        <RewardCard
          reward={mockDashboardData.available_rewards[1]}
          loyaltyModel="POINTS"
          userBalance={150}
          onSelect={mockSelect}
        />
      );

      expect(screen.getByText('Specialty Lunch Panini')).toBeInTheDocument();
      expect(screen.getByText('250 pts')).toBeInTheDocument();
      expect(screen.getByText('Need 100 more')).toBeInTheDocument();
    });

    it('RewardDetailModal shows correct cost deduction and handles server redemption', async () => {
      const onRedeemedMock = vi.fn();
      const onCloseMock = vi.fn();

      vi.mocked(api.redeemReward).mockResolvedValueOnce({
        status: 'ISSUED',
        redemption_id: 'red-uuid-1',
        code: 'RD-TEST-9999',
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
        points_cost: 100,
        remaining_balance: 50,
        is_idempotent_replay: false,
      });

      render(
        <RewardDetailModal
          reward={mockDashboardData.available_rewards[0]}
          restaurantId="rest-uuid-1"
          userBalance={150}
          loyaltyModel="POINTS"
          isOpen={true}
          onClose={onCloseMock}
          onRedeemed={onRedeemedMock}
        />
      );

      expect(screen.getByText('Reward Details')).toBeInTheDocument();
      expect(screen.getByText('Your Current Balance')).toBeInTheDocument();
      expect(screen.getByText('150 points')).toBeInTheDocument();
      expect(screen.getByText('-100 points')).toBeInTheDocument();
      expect(screen.getByText('50 points')).toBeInTheDocument();

      // Click Confirm & Redeem
      const redeemBtn = screen.getByText(/Confirm & Redeem/);
      fireEvent.click(redeemBtn);

      await waitFor(() => {
        expect(api.redeemReward).toHaveBeenCalledWith('rew-1', 'rest-uuid-1');
        expect(onRedeemedMock).toHaveBeenCalled();
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  describe('5. Redemption Confirmation Modal', () => {
    it('displays single-use code and active countdown', () => {
      render(
        <RedemptionActiveModal
          isOpen={true}
          onClose={() => {}}
          redemption={{
            code: 'RD-SAFE-7890',
            expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
            reward_title: 'Free Artisanal Pour-Over',
            points_cost: 100,
          }}
        />
      );

      expect(screen.getByText('Redemption Pass')).toBeInTheDocument();
      expect(screen.getByText('RD-SAFE-7890')).toBeInTheDocument();
      expect(screen.getByText(/Expires in:/)).toBeInTheDocument();
    });
  });

  describe('6. Customer Dashboard Integration', () => {
    it('renders dashboard with points, rewards, activity tabs, and profile sheet', async () => {
      vi.mocked(api.getRestaurantLanding).mockResolvedValue({
        restaurant: mockRestaurantPoints,
        settings: mockSettingsPoints,
        sample_rewards: [],
      });
      vi.mocked(api.getDashboard).mockResolvedValue(mockDashboardData);
      vi.mocked(api.getProfile).mockResolvedValue(mockProfile);

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </RestaurantProvider>
      );

      // Wait for dashboard data to load
      expect(await screen.findByText('150')).toBeInTheDocument();
      expect(screen.getByText('Free Artisanal Pour-Over')).toBeInTheDocument();
      expect(screen.getByText('Specialty Lunch Panini')).toBeInTheDocument();

      // Test tab switching to Activity
      const activityTabBtn = screen.getByRole('button', { name: /Activity/i });
      fireEvent.click(activityTabBtn);

      expect(await screen.findByText('In-store order #4812')).toBeInTheDocument();
      expect(screen.getByText('+45')).toBeInTheDocument();
      expect(screen.getByText('Redeemed Free Artisanal Pour-Over')).toBeInTheDocument();
      expect(screen.getByText('-100')).toBeInTheDocument();

      // Test tab switching to Perks / Rules
      const perksTabBtn = screen.getByRole('button', { name: /Perks/i });
      fireEvent.click(perksTabBtn);

      expect(await screen.findByText(/10 Points per \$1 Spent/)).toBeInTheDocument();
      expect(screen.getByText('Terms & Conditions')).toBeInTheDocument();
    });

    it('renders empty transaction ledger state when customer has no past orders', async () => {
      const emptyDashboardData = {
        ...mockDashboardData,
        recent_transactions: [],
      };
      vi.mocked(api.getRestaurantLanding).mockResolvedValue({
        restaurant: mockRestaurantPoints,
        settings: mockSettingsPoints,
        sample_rewards: [],
      });
      vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboardData);

      render(
        <RestaurantProvider initialSlug="artisan-coffee">
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </RestaurantProvider>
      );

      // Switch to Activity
      const activityTabBtn = await screen.findByRole('button', { name: /Activity/i });
      fireEvent.click(activityTabBtn);

      expect(await screen.findByText('No activity yet')).toBeInTheDocument();
    });
  });

  describe('7. Customer Profile Sheet & Logout', () => {
    it('allows updating profile and logging out', async () => {
      const onProfileUpdated = vi.fn();
      const onLogout = vi.fn();
      vi.mocked(api.updateProfile).mockResolvedValueOnce({
        ...mockProfile,
        full_name: 'Alice Cooper Updated',
      });

      render(
        <ProfileSheet
          isOpen={true}
          onClose={() => {}}
          profile={mockProfile}
          onProfileUpdated={onProfileUpdated}
          onLogout={onLogout}
        />
      );

      expect(screen.getByText('My Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alice Cooper')).toBeInTheDocument();
      expect(screen.getByText('+15551234567')).toBeInTheDocument();

      // Edit name and submit
      const nameInput = screen.getByDisplayValue('Alice Cooper');
      fireEvent.change(nameInput, { target: { value: 'Alice Cooper Updated' } });

      const saveBtn = screen.getByText('Save Changes');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.updateProfile).toHaveBeenCalledWith({
          full_name: 'Alice Cooper Updated',
          email: 'alice@example.com',
          birthday: '1995-05-15',
        });
        expect(onProfileUpdated).toHaveBeenCalled();
      });

      // Test Log Out button
      const logoutBtn = screen.getByText('Log Out');
      fireEvent.click(logoutBtn);
      expect(onLogout).toHaveBeenCalled();
    });
  });
});
