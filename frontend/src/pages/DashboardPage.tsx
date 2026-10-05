// ============================================================================
// File: frontend/src/pages/DashboardPage.tsx
// Description: Customer-facing loyalty dashboard with SA Dosa Cafe branding,
//              7-stamp card, claim modal, celebration popup, & social section
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  History,
  Info,
  RefreshCw,
  User,
  AlertCircle,
  Ticket,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import type { DashboardData, Reward, ActiveRedemption } from '../types/index.js';
import { DigitalLoyaltyCard } from '../components/customer/DigitalLoyaltyCard.js';
import { RewardCard } from '../components/customer/RewardCard.js';
import { RewardDetailModal } from '../components/customer/RewardDetailModal.js';
import { RedemptionActiveModal } from '../components/customer/RedemptionActiveModal.js';
import { ClaimStampModal } from '../components/customer/ClaimStampModal.js';
import { SeventhStampCelebrationModal } from '../components/customer/SeventhStampCelebrationModal.js';
import { SocialAndReviewSection } from '../components/customer/SocialAndReviewSection.js';
import { TransactionItem } from '../components/customer/TransactionItem.js';
import { ProfileSheet } from '../components/customer/ProfileSheet.js';
import { SaDosaCafeLogo } from '../components/common/SaDosaCafeLogo.js';
import { LoyaltyCardSkeleton, RewardCardSkeleton, Skeleton } from '../components/common/Skeleton.js';
import { Button } from '../components/common/Button.js';

interface DashboardPageProps {
  onBackToLanding?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = () => {
  const { restaurant, settings } = useRestaurant();
  const { profile, logout, refreshProfile } = useAuth();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab State: 'rewards' | 'activity' | 'info'
  const [activeTab, setActiveTab] = useState<'rewards' | 'activity' | 'info'>('rewards');
  const [filterEligibleOnly, setFilterEligibleOnly] = useState<boolean>(false);

  // Modals state
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [activeRedemptionModal, setActiveRedemptionModal] = useState<ActiveRedemption | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isClaimStampOpen, setIsClaimStampOpen] = useState<boolean>(false);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState<boolean>(false);
  const [stampSuccessBanner, setStampSuccessBanner] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (showRefreshingIndicator = false) => {
    if (!restaurant) return;
    try {
      if (showRefreshingIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const data = await api.getDashboard(restaurant.id);
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'Unable to load loyalty account. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [restaurant]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle successful stamp claimed from cashier
  const handleStampClaimedSuccess = (newStamps: number) => {
    const target = settings?.stamps_target_count || 7;
    setStampSuccessBanner(`Stamp claimed! 🎉 ${newStamps} of ${target} completed`);

    // Auto dismiss banner after 6 seconds
    setTimeout(() => {
      setStampSuccessBanner(null);
    }, 6000);

    // If 7th stamp reached, open celebration
    if (newStamps >= target) {
      setTimeout(() => {
        setIsCelebrationOpen(true);
      }, 500);
    }

    fetchDashboardData(true);
  };

  // Handler for successful reward redemption from server
  const handleRedemptionSuccess = (result: {
    status: string;
    redemption_id: string;
    code: string;
    expires_at: string;
    points_cost: number;
    remaining_balance: number;
  }) => {
    setActiveRedemptionModal({
      id: result.redemption_id,
      code: result.code,
      status: 'ISSUED',
      points_cost: result.points_cost,
      issued_at: new Date().toISOString(),
      expires_at: result.expires_at,
      reward_title: selectedReward?.title || 'Reward Pass',
    });

    fetchDashboardData(true);
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 p-4 space-y-5">
        <div className="flex justify-between items-center py-2">
          <Skeleton className="w-36 h-7 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="w-9 h-9 rounded-xl" />
          </div>
        </div>
        <LoyaltyCardSkeleton />
        <div className="flex gap-2">
          <Skeleton className="w-1/3 h-10 rounded-xl" />
          <Skeleton className="w-1/3 h-10 rounded-xl" />
          <Skeleton className="w-1/3 h-10 rounded-xl" />
        </div>
        <div className="space-y-3">
          <RewardCardSkeleton />
          <RewardCardSkeleton />
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Failed to Load Dashboard</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">{error}</p>
        <div className="mt-5 w-full max-w-xs">
          <Button variant="primary" fullWidth onClick={() => fetchDashboardData()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardData || !restaurant) {
    return null;
  }

  const { loyalty_account, membership, available_rewards, recent_transactions, active_redemptions } =
    dashboardData;
  const isStamps = loyalty_account.loyalty_model === 'STAMPS';
  const targetStamps = settings?.stamps_target_count || 7;
  const currentBalance = loyalty_account.current_balance;

  const isSaDosaCafe =
    restaurant.slug === 'sa-dosa-cafe' ||
    restaurant.name.toLowerCase().includes('dosa');

  // Customer friendly first name
  const customerFirstName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : 'Friend';

  // Find active issued redemption
  const currentActiveRedemption = active_redemptions.find((r) => r.status === 'ISSUED');

  // Filter rewards
  const displayedRewards = available_rewards.filter((r) =>
    filterEligibleOnly ? r.cost_points_stamps <= currentBalance : true
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-20 flex flex-col text-slate-800">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-amber-200/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSaDosaCafe ? (
            <SaDosaCafeLogo size="sm" variant="compact" />
          ) : restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-8 h-8 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-xs"
              style={{ backgroundColor: restaurant.brand_color || '#FF6310' }}
            >
              {restaurant.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all active:scale-95 cursor-pointer"
            title="Refresh Account Data"
            aria-label="Refresh Account Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FF6310]' : ''}`} />
          </button>

          <button
            onClick={() => setIsProfileOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="Customer Profile"
            aria-label="Customer Profile"
          >
            <div className="w-7 h-7 rounded-full bg-orange-100 text-[#FF6310] flex items-center justify-center text-xs font-bold border border-orange-200">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4 flex-1">
        {/* Personalized Welcome Banner */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Good to see you again, {customerFirstName}! 👋
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isStamps
                ? currentBalance >= targetStamps
                  ? 'Your free reward is unlocked and ready!'
                  : `${targetStamps - currentBalance} more visits to unlock your reward`
                : `${currentBalance} points available to redeem`}
            </p>
          </div>
        </div>

        {/* Live Stamp Claimed Success Alert */}
        {stampSuccessBanner && (
          <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-md flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-black tracking-tight">{stampSuccessBanner}</span>
          </div>
        )}

        {/* Active Redemption Banner (Alert) */}
        {currentActiveRedemption && (
          <div
            onClick={() => setActiveRedemptionModal(currentActiveRedemption)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100 block">
                  Active Reward Pass
                </span>
                <p className="text-xs font-extrabold truncate">
                  {currentActiveRedemption.reward_title || 'Your Reward'} ({currentActiveRedemption.code})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold shrink-0 bg-white/20 px-2.5 py-1 rounded-xl">
              <span>View Pass</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Digital Loyalty Card */}
        <DigitalLoyaltyCard
          restaurant={restaurant}
          loyaltyAccount={loyalty_account}
          membership={membership}
          targetStamps={targetStamps}
          onClaimClick={() => setIsClaimStampOpen(true)}
        />

        {/* Prominent Stamp Claim CTA Button */}
        {isStamps && currentBalance < targetStamps && (
          <button
            type="button"
            onClick={() => setIsClaimStampOpen(true)}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FF6310] to-[#E05307] hover:from-[#E05307] hover:to-[#C2410C] text-white font-black text-sm rounded-2xl shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>CLAIM TODAY'S STAMP</span>
          </button>
        )}

        {/* 7th Stamp Unlocked Highlight Box */}
        {isStamps && currentBalance >= targetStamps && (
          <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/20 border-2 border-amber-300 rounded-3xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF6310] text-white flex items-center justify-center shadow-xs">
                <Gift className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6310] block">
                  Reward Unlocked 🎉
                </span>
                <span className="text-sm font-black text-slate-900 block leading-tight">
                  Free Reward Ready
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('rewards');
                if (available_rewards.length > 0) setSelectedReward(available_rewards[0]);
              }}
              className="px-4 py-2 bg-[#FF6310] hover:bg-[#E05307] text-white text-xs font-black rounded-xl shadow-xs active:scale-95 cursor-pointer"
            >
              REDEEM NOW
            </button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="bg-slate-200/70 p-1 rounded-2xl flex items-center text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'hover:text-slate-800'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Rewards ({available_rewards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'hover:text-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Perks & Rules</span>
          </button>
        </div>

        {/* TAB 1: REWARDS CATALOG */}
        {activeTab === 'rewards' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                {isStamps ? 'Available Stamp Rewards' : 'Rewards Catalog'}
              </span>
              <button
                type="button"
                onClick={() => setFilterEligibleOnly(!filterEligibleOnly)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  filterEligibleOnly
                    ? 'bg-emerald-100 text-emerald-800 font-bold'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                {filterEligibleOnly ? 'Showing Redeemable' : 'Filter Redeemable'}
              </button>
            </div>

            {displayedRewards.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {displayedRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userBalance={currentBalance}
                    loyaltyModel={loyalty_account.loyalty_model}
                    onSelect={() => setSelectedReward(reward)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-200/80 p-6 space-y-2">
                <Gift className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No matching rewards</p>
                <p className="text-[11px] text-slate-400">
                  {filterEligibleOnly
                    ? 'Keep collecting stamps to unlock rewards.'
                    : 'No rewards currently active.'}
                </p>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: TRANSACTION HISTORY */}
        {activeTab === 'activity' && (
          <section className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Audited Stamp & Visit History
              </span>
              <span className="text-[11px] text-slate-400">
                Secure Ledger
              </span>
            </div>

            {recent_transactions && recent_transactions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recent_transactions.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <History className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">No activity yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Present your claim code at checkout to record visits and collect stamps.
                </p>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: PROGRAM INFO & RULES */}
        {activeTab === 'info' && (
          <section className="space-y-3">
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                How to Earn & Claim
              </h4>
              <div className="text-xs space-y-2.5 text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#FF6310] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">
                      {isStamps ? '1 Stamp per Visit' : `${settings?.points_per_currency_unit || 10} Points per $1 Spent`}
                    </strong>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isStamps
                        ? 'Tap "CLAIM TODAY\'S STAMP" and show the 6-digit verification code to the cashier.'
                        : 'Earn points automatically on every verified order in-store or online.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Gift className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">7th Stamp Milestone Reward</strong>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Once you collect 7 stamps, unlock a signature reward on the house.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {settings?.terms_and_conditions && (
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs text-xs text-slate-500 space-y-1.5">
                <span className="font-bold text-slate-700 block">Terms & Conditions</span>
                <p className="leading-relaxed text-[11px] whitespace-pre-line">
                  {settings.terms_and_conditions}
                </p>
              </div>
            )}
          </section>
        )}

        {/* SOCIAL MEDIA & GOOGLE REVIEW SECTION (Sections 11 & 12) */}
        <SocialAndReviewSection
          restaurant={restaurant}
          settings={settings}
        />
      </main>

      {/* Claim Stamp Code Modal */}
      <ClaimStampModal
        isOpen={isClaimStampOpen}
        onClose={() => setIsClaimStampOpen(false)}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        initialClaim={dashboardData.active_stamp_claim}
        currentStamps={currentBalance}
        targetStamps={targetStamps}
        onStampClaimedSuccess={handleStampClaimedSuccess}
      />

      {/* Seventh Stamp Celebration Modal */}
      <SeventhStampCelebrationModal
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        restaurantName={restaurant.name}
        rewardTitle={available_rewards[0]?.title || 'FREE REWARD'}
        onViewReward={() => {
          setActiveTab('rewards');
          if (available_rewards.length > 0) setSelectedReward(available_rewards[0]);
        }}
      />

      {/* Reward Details Modal */}
      <RewardDetailModal
        reward={selectedReward}
        restaurantId={restaurant.id}
        userBalance={currentBalance}
        loyaltyModel={loyalty_account.loyalty_model}
        isOpen={!!selectedReward}
        onClose={() => setSelectedReward(null)}
        onRedeemed={handleRedemptionSuccess}
      />

      {/* Active Redemption Pass Modal */}
      <RedemptionActiveModal
        isOpen={!!activeRedemptionModal}
        onClose={() => setActiveRedemptionModal(null)}
        redemption={activeRedemptionModal}
      />

      {/* Profile Management Sheet */}
      <ProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onProfileUpdated={refreshProfile}
        onLogout={logout}
      />
    </div>
  );
};
