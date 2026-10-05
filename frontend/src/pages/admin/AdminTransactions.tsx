// ============================================================================
// File: frontend/src/pages/admin/AdminTransactions.tsx
// Description: Auditable loyalty ledger explorer with type filtering & search
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminTransactions: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTransactions = async (showRefresh = false) => {
    if (!restaurant) return;
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await api.admin.getTransactions(restaurant.id, 50, 0);
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [restaurant]);

  const filtered = transactions.filter((t) => {
    if (typeFilter === 'ALL') return true;
    return t.type === typeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-400" />
            <span>Audited Transaction Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable, append-only ledger tracking every credit, debit, redemption, and manual adjustment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTransactions(true)}
            disabled={isRefreshing}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-800/60 p-1.5 rounded-2xl border border-slate-700/60 text-xs font-bold">
        {[
          { id: 'ALL', label: 'All Transactions' },
          { id: 'PURCHASE', label: 'Purchases' },
          { id: 'VISIT', label: 'Visits' },
          { id: 'REWARD_REDEMPTION', label: 'Redemptions' },
          { id: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustments' },
          { id: 'BONUS', label: 'Bonuses' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              typeFilter === tab.id
                ? 'bg-brand-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-700/80">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Description / Reason</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-right">Points / Stamps</th>
                  <th className="py-3.5 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {filtered.map((tx) => {
                  const isCredit = tx.points_stamps > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(tx.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-white block font-semibold">
                          {tx.customer_name || 'Anonymous'}
                        </strong>
                        <span className="text-[11px] text-slate-400 font-mono">{tx.customer_phone}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.type === 'PURCHASE' || tx.type === 'VISIT'
                              ? 'bg-blue-500/20 text-blue-300'
                              : tx.type === 'REWARD_REDEMPTION'
                              ? 'bg-rose-500/20 text-rose-300'
                              : tx.type === 'MANUAL_ADJUSTMENT'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-200">
                        {tx.description}
                      </td>

                      <td className="py-3.5 px-4 uppercase text-[10px] font-mono text-slate-400">
                        {tx.source}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? `+${tx.points_stamps}` : tx.points_stamps}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-bold text-white text-sm">No transactions match filter</p>
            <p className="text-slate-500 mt-1">
              Select another transaction type or perform orders to generate ledger activity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
