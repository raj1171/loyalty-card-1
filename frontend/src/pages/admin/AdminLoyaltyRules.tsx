// ============================================================================
// File: frontend/src/pages/admin/AdminLoyaltyRules.tsx
// Description: Loyalty rules engine, model configuration, and point/stamp rates
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  Coffee,
  Check,
  AlertCircle,
  Save,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { LoyaltyModel } from '../../types/index.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminLoyaltyRules: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [loyaltyModel, setLoyaltyModel] = useState<LoyaltyModel>('POINTS');
  const [pointsPerDollar, setPointsPerDollar] = useState('10');
  const [stampsTarget, setStampsTarget] = useState('10');
  const [stampMinSpend, setStampMinSpend] = useState('5.00');
  const [welcomePoints, setWelcomePoints] = useState('50');
  const [welcomeStamps, setWelcomeStamps] = useState('1');
  const [rewardExpiryDays, setRewardExpiryDays] = useState('30');
  const [redemptionTtlMinutes, setRedemptionTtlMinutes] = useState('15');
  const [terms, setTerms] = useState('');

  const loadSettings = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const data = await api.admin.getSettings(restaurant.id);
      if (data) {
        setLoyaltyModel(data.loyalty_model || 'POINTS');
        setPointsPerDollar(data.points_per_currency_unit?.toString() || '10');
        setStampsTarget(data.stamps_target_count?.toString() || '10');
        setStampMinSpend(data.stamp_minimum_spend?.toString() || '0');
        setWelcomePoints(data.welcome_bonus_points?.toString() || '0');
        setWelcomeStamps(data.welcome_bonus_stamps?.toString() || '0');
        setRewardExpiryDays(data.reward_expiry_days?.toString() || '30');
        setRedemptionTtlMinutes(data.redemption_code_ttl_minutes?.toString() || '15');
        setTerms(data.terms_and_conditions || '');
      }
    } catch (err) {
      console.error('Failed to load loyalty settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [restaurant]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.admin.updateSettings(restaurant.id, {
        loyalty_model: loyaltyModel,
        points_per_currency_unit: parseFloat(pointsPerDollar) || 10,
        stamps_target_count: parseInt(stampsTarget, 10) || 10,
        stamp_minimum_spend: parseFloat(stampMinSpend) || 0,
        welcome_bonus_points: parseInt(welcomePoints, 10) || 0,
        welcome_bonus_stamps: parseInt(welcomeStamps, 10) || 0,
        reward_expiry_days: parseInt(rewardExpiryDays, 10) || 30,
        redemption_code_ttl_minutes: parseInt(redemptionTtlMinutes, 10) || 15,
        terms_and_conditions: terms.trim() || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'Failed to update loyalty settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-48 h-8 rounded-xl bg-slate-800" />
        <Skeleton className="h-64 rounded-2xl bg-slate-800" />
        <Skeleton className="h-48 rounded-2xl bg-slate-800" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-brand-400" />
            <span>Loyalty Program Rules</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Define earning ratios, welcome bonuses, redemption pass TTL, and loyalty program terms.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Rule Changes
        </Button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Loyalty rules updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loyalty Model Selector */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Core Loyalty Model
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Points Based */}
          <div
            onClick={() => setLoyaltyModel('POINTS')}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              loyaltyModel === 'POINTS'
                ? 'bg-brand-500/10 border-brand-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" />
                <h4 className="font-extrabold text-white text-sm">Points-Based Program</h4>
              </div>
              <input
                type="radio"
                name="loyalty_model"
                checked={loyaltyModel === 'POINTS'}
                onChange={() => setLoyaltyModel('POINTS')}
                className="w-4 h-4 text-brand-500"
              />
            </div>
            <p className="text-xs text-slate-400">
              Customers earn points proportional to the dollar amount spent on each order (e.g. 10 points per $1).
            </p>
          </div>

          {/* Option 2: Stamps Based */}
          <div
            onClick={() => setLoyaltyModel('STAMPS')}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              loyaltyModel === 'STAMPS'
                ? 'bg-brand-500/10 border-brand-500 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h4 className="font-extrabold text-white text-sm">Stamp Card / Visit-Based</h4>
              </div>
              <input
                type="radio"
                name="loyalty_model"
                checked={loyaltyModel === 'STAMPS'}
                onChange={() => setLoyaltyModel('STAMPS')}
                className="w-4 h-4 text-brand-500"
              />
            </div>
            <p className="text-xs text-slate-400">
              Customers earn 1 stamp per qualifying visit. Once they collect the target number of stamps, rewards unlock.
            </p>
          </div>
        </div>
      </div>

      {/* Model-Specific Parameters */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          {loyaltyModel === 'POINTS' ? 'Points Earning Parameters' : 'Stamp Earning Parameters'}
        </h3>

        {loyaltyModel === 'POINTS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Points per $1 Spent
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={pointsPerDollar}
                onChange={(e) => setPointsPerDollar(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                A $20 purchase yields {(parseFloat(pointsPerDollar) || 10) * 20} points.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                New Member Welcome Points
              </label>
              <input
                type="number"
                min="0"
                value={welcomePoints}
                onChange={(e) => setWelcomePoints(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                Credited automatically on digital membership registration.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Stamps to Unlock Reward
              </label>
              <input
                type="number"
                min="1"
                value={stampsTarget}
                onChange={(e) => setStampsTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                Default: 10 stamps per reward cycle.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Minimum Spend per Stamp ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={stampMinSpend}
                onChange={(e) => setStampMinSpend(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                Customer must spend this amount to earn a stamp.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Welcome Bonus Stamps
              </label>
              <input
                type="number"
                min="0"
                value={welcomeStamps}
                onChange={(e) => setWelcomeStamps(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                Stamps pre-stamped on new card signup.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Global Expiry & Pass Security */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Redemption & Security Timers
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Default Reward Expiry (Days)
            </label>
            <input
              type="number"
              min="1"
              value={rewardExpiryDays}
              onChange={(e) => setRewardExpiryDays(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <span className="block text-[11px] text-slate-400 mt-1">
              Validity duration for published rewards before automatic expiration.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Redemption Pass TTL (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={redemptionTtlMinutes}
              onChange={(e) => setRedemptionTtlMinutes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <span className="block text-[11px] text-slate-400 mt-1">
              Customer has this many minutes to show their code to staff before auto-voiding.
            </span>
          </div>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-2">
        <label className="block text-xs font-bold text-white uppercase tracking-wider">
          Terms & Conditions / Program Disclosure
        </label>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          placeholder="e.g. Points expire after 90 days of account inactivity. Rewards cannot be exchanged for cash..."
          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-brand-500 outline-none"
        />
      </div>
    </form>
  );
};
