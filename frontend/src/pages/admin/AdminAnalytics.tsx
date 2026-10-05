// ============================================================================
// File: frontend/src/pages/admin/AdminAnalytics.tsx
// Description: Visual analytics, loyalty economy breakdown, and KPI metrics
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Award,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { AdminAnalytics as AnalyticsData } from '../../types/index.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminAnalytics: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const res = await api.admin.getAnalytics(restaurant.id);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [restaurant]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-48 h-8 rounded-xl bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
        </div>
      </div>
    );
  }

  const pointsIssued = data.points_issued || 0;
  const pointsRedeemed = data.points_redeemed || 0;
  const outstandingPoints = Math.max(0, pointsIssued - pointsRedeemed);
  const totalRedemptions = data.redemptions?.total_requested || 0;
  const fulfilledRedemptions = data.redemptions?.total_fulfilled || 0;
  const fulfillmentRate = totalRedemptions > 0 ? Math.round((fulfilledRedemptions / totalRedemptions) * 100) : 0;
  const totalVisits = data.visits?.total_visits || 0;
  const totalSpend = parseFloat(data.visits?.total_spend?.toString() || '0');
  const avgSpend = totalVisits > 0 ? (totalSpend / totalVisits).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            <span>Program Analytics & ROI</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyze loyalty engagement, points economy liabilities, and customer visitation metrics.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Redemption Rate
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{fulfillmentRate}%</span>
            <span className="text-xs text-emerald-400 font-semibold">of requests</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {fulfilledRedemptions} fulfilled of {totalRedemptions} issued passes
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Average Spend / Visit
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-brand-400">${avgSpend}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Calculated across {totalVisits} recorded orders
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Outstanding Points
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{outstandingPoints}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Active customer balance liability
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Attributed Sales
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">${totalSpend.toFixed(2)}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            In-store loyalty customer revenue
          </span>
        </div>
      </div>

      {/* Visual Points Economy Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Points Economy Balance</span>
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Total Points Issued</span>
                <span className="font-bold text-white">{pointsIssued} pts</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Total Points Redeemed</span>
                <span className="font-bold text-emerald-400">{pointsRedeemed} pts</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: pointsIssued > 0 ? `${(pointsRedeemed / pointsIssued) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Outstanding Liability (Unspent)</span>
                <span className="font-bold text-amber-400">{outstandingPoints} pts</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: pointsIssued > 0 ? `${(outstandingPoints / pointsIssued) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Redemptions Breakdown */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Redemptions Status Funnel</span>
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Requested</span>
              <span className="text-2xl font-extrabold text-white mt-1 block">
                {data.redemptions?.total_requested || 0}
              </span>
              <span className="text-[10px] text-slate-500">all passes</span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-[10px] font-bold uppercase text-emerald-400 block">Fulfilled</span>
              <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">
                {data.redemptions?.total_fulfilled || 0}
              </span>
              <span className="text-[10px] text-emerald-400/80">{fulfillmentRate}% rate</span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-[10px] font-bold uppercase text-amber-400 block">Active Now</span>
              <span className="text-2xl font-extrabold text-amber-400 mt-1 block">
                {data.redemptions?.total_active || 0}
              </span>
              <span className="text-[10px] text-amber-400/80">awaiting pickup</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
