// ============================================================================
// File: frontend/src/pages/admin/AdminDashboard.tsx
// Description: Admin portal high-level dashboard and metrics overview
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Award,
  CheckCircle2,
  TrendingUp,
  Receipt,
  QrCode,
  Gift,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { AdminAnalytics, AdminRedemption, LoyaltyTransaction } from '../../types/index.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import type { AdminTab } from '../../components/admin/AdminLayout.js';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { restaurant } = useRestaurant();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<AdminRedemption[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = async (showRefresh = false) => {
    if (!restaurant) return;
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const [analyticsData, redemptionsData, transactionsData] = await Promise.all([
        api.admin.getAnalytics(restaurant.id),
        api.admin.getRedemptions(restaurant.id, undefined, 5, 0),
        api.admin.getTransactions(restaurant.id, 5, 0),
      ]);

      setAnalytics(analyticsData);
      setRecentRedemptions(redemptionsData.redemptions || []);
      setRecentTransactions(transactionsData.transactions || []);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [restaurant]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="w-48 h-8 rounded-xl bg-slate-800" />
          <Skeleton className="w-24 h-8 rounded-xl bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
          <Skeleton className="h-28 rounded-2xl bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl bg-slate-800" />
          <Skeleton className="h-64 rounded-2xl bg-slate-800" />
        </div>
      </div>
    );
  }

  const isStamps = restaurant?.currency === 'STAMPS';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {restaurant?.name} Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time loyalty program performance, member velocity, and transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigateTab('redemptions')}
            className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Scan / Verify Code</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Members */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Members
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {analytics?.total_members || 0}
            </span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Active
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Registered customer digital cards
          </span>
        </div>

        {/* Card 2: Points / Stamps Issued */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isStamps ? 'Stamps Issued' : 'Points Issued'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {analytics?.points_issued || 0}
            </span>
            <span className="text-xs text-slate-400">lifetime</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Points accrued across all orders
          </span>
        </div>

        {/* Card 3: Redemptions Fulfilled */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Redemptions Fulfilled
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {analytics?.redemptions?.total_fulfilled || 0}
            </span>
            <span className="text-xs text-slate-400">
              / {analytics?.redemptions?.total_requested || 0} requested
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {analytics?.redemptions?.total_active || 0} currently active passes
          </span>
        </div>

        {/* Card 4: Customer Visits & Spend */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recorded Visits
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {analytics?.visits?.total_visits || 0}
            </span>
            <span className="text-xs text-purple-300 font-semibold">
              ${analytics?.visits?.total_spend || '0.00'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Total attributed in-store revenue
          </span>
        </div>
      </div>

      {/* Quick Operations Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigateTab('rewards')}
          className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 rounded-xl text-left transition-all group"
        >
          <Gift className="w-5 h-5 text-brand-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">Manage Rewards</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Create & edit perks</p>
        </button>

        <button
          onClick={() => onNavigateTab('customers')}
          className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 rounded-xl text-left transition-all group"
        >
          <Users className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">Customers</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Directory & balance adjust</p>
        </button>

        <button
          onClick={() => onNavigateTab('qr')}
          className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 rounded-xl text-left transition-all group"
        >
          <QrCode className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">QR Management</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Printable table cards</p>
        </button>

        <button
          onClick={() => onNavigateTab('rules')}
          className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 rounded-xl text-left transition-all group"
        >
          <Sparkles className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">Loyalty Rules</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Configure points & stamps</p>
        </button>
      </div>

      {/* Two Column Layout: Recent Redemptions & Recent Ledger Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Redemptions */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Recent Redemptions</h3>
              </div>
              <button
                onClick={() => onNavigateTab('redemptions')}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentRedemptions.length > 0 ? (
              <div className="divide-y divide-slate-700/40">
                {recentRedemptions.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{r.reward_title}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-300 font-semibold">{r.code}</span>
                        <span>•</span>
                        <span>{r.customer_name || r.customer_phone}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'REDEEMED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : r.status === 'ISSUED'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {r.points_cost} {isStamps ? 'stamps' : 'pts'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                No redemptions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Audited Transactions */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
              </div>
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                <span>View ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentTransactions.length > 0 ? (
              <div className="divide-y divide-slate-700/40">
                {recentTransactions.map((tx) => {
                  const isCredit = tx.points_stamps > 0;
                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{tx.description}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="uppercase text-[10px] font-bold text-slate-500">{tx.type}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? `+${tx.points_stamps}` : tx.points_stamps}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          bal: {tx.balance_after}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                No ledger transactions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
