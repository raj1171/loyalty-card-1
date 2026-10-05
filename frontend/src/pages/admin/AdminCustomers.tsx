// ============================================================================
// File: frontend/src/pages/admin/AdminCustomers.tsx
// Description: Customer directory, customer detail drawer, and balance adjustment
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Eye,
  Phone,
  Mail,
  Calendar,
  Plus,
  Minus,
  AlertCircle,
  Receipt,
  Check,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { AdminCustomer, AdminCustomerDetail } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminCustomers: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected customer for detail modal & manual adjustment
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Manual Adjust Modal
  const [adjustCustomer, setAdjustCustomer] = useState<AdminCustomer | null>(null);
  const [adjustPoints, setAdjustPoints] = useState<string>('25');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustReason, setAdjustReason] = useState<string>('Customer courtesy bonus');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState(false);

  const fetchCustomers = async (query = '') => {
    if (!restaurant) return;
    try {
      const res = await api.admin.getCustomers(restaurant.id, query);
      setCustomers(res?.customers || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchQuery);
  }, [restaurant]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(searchQuery);
  };

  // Open detail modal
  const openCustomerDetail = async (customerId: string) => {
    if (!restaurant) return;
    setSelectedCustomerId(customerId);
    try {
      setIsDetailLoading(true);
      const data = await api.admin.getCustomer(restaurant.id, customerId);
      setCustomerDetail(data);
    } catch (err) {
      console.error('Failed to load customer detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Handle manual adjustment
  const handlePerformAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !adjustCustomer) return;
    const num = parseInt(adjustPoints, 10);
    if (isNaN(num) || num <= 0) {
      setAdjustError('Please enter a valid amount.');
      return;
    }
    const finalDelta = adjustType === 'ADD' ? num : -num;

    try {
      setIsAdjusting(true);
      setAdjustError(null);
      await api.admin.adjustCustomerBalance(
        restaurant.id,
        adjustCustomer.id,
        finalDelta,
        adjustReason.trim() || 'Manual adjustment by staff'
      );
      setAdjustSuccess(true);
      fetchCustomers(searchQuery);
      setTimeout(() => {
        setAdjustCustomer(null);
        setAdjustSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error('Adjustment failed:', err);
      setAdjustError(err.message || 'Balance adjustment failed.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const isStamps = restaurant?.currency === 'STAMPS';

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            <span>Customers Directory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search members, view transaction history, and perform audited balance adjustments.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone, name, member #..."
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
          </div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-700/80">
                <tr>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Member ID</th>
                  <th className="py-3.5 px-4">Current Balance</th>
                  <th className="py-3.5 px-4">Lifetime Accrued</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.full_name ? c.full_name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <strong className="text-white block font-semibold">
                            {c.full_name || 'Anonymous Member'}
                          </strong>
                          <span className="text-[11px] text-slate-400 font-mono">{c.phone}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      {c.membership_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-sm text-brand-400">
                        {c.current_balance}
                      </span>{' '}
                      <span className="text-[10px] text-slate-400">
                        {isStamps ? 'stamps' : 'pts'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-medium">
                      {c.lifetime_accrued} {isStamps ? 'stamps' : 'pts'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(c.joined_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openCustomerDetail(c.id)}
                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setAdjustCustomer(c);
                          setAdjustPoints('25');
                          setAdjustType('ADD');
                          setAdjustReason('Customer courtesy bonus');
                          setAdjustError(null);
                        }}
                        className="px-2.5 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 rounded-lg text-[11px] font-bold transition-all"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-bold text-white text-sm">No customers found</p>
            <p className="text-slate-500 mt-1">
              Customers will automatically appear here once they scan your QR code and join your loyalty program.
            </p>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      <Modal
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        title="Customer Profile & History"
        maxWidth="lg"
      >
        {isDetailLoading || !customerDetail ? (
          <div className="p-4 space-y-4">
            <Skeleton className="w-full h-24 rounded-2xl" />
            <Skeleton className="w-full h-40 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top Identity Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {customerDetail.full_name || 'Anonymous Customer'}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-mono text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customerDetail.phone}
                  </span>
                  {customerDetail.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {customerDetail.email}
                    </span>
                  )}
                  {customerDetail.birthday && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {customerDetail.birthday}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                  Membership ID
                </span>
                <span className="font-mono text-sm font-extrabold text-brand-600">
                  {customerDetail.membership_number}
                </span>
              </div>
            </div>

            {/* Balance Summary Box */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Balance</span>
                <span className="text-xl font-extrabold text-emerald-600">
                  {customerDetail.current_balance}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lifetime Earned</span>
                <span className="text-xl font-extrabold text-slate-800">
                  {customerDetail.lifetime_accrued}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lifetime Redeemed</span>
                <span className="text-xl font-extrabold text-rose-600">
                  {customerDetail.lifetime_redeemed}
                </span>
              </div>
            </div>

            {/* Recent Ledger Transactions */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span>Recent Transactions</span>
              </h4>

              {customerDetail.recent_transactions && customerDetail.recent_transactions.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {customerDetail.recent_transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-500">
                            {tx.type}
                          </td>
                          <td className="py-2 px-3">{tx.description}</td>
                          <td
                            className={`py-2 px-3 text-right font-bold font-mono ${
                              tx.points_stamps > 0 ? 'text-emerald-600' : 'text-slate-800'
                            }`}
                          >
                            {tx.points_stamps > 0 ? `+${tx.points_stamps}` : tx.points_stamps}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                  No transaction history recorded yet.
                </p>
              )}
            </div>

            <Button variant="secondary" fullWidth onClick={() => setSelectedCustomerId(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* Manual Balance Adjust Modal */}
      <Modal
        isOpen={!!adjustCustomer}
        onClose={() => setAdjustCustomer(null)}
        title="Manual Balance Adjustment"
        maxWidth="sm"
      >
        {adjustCustomer && (
          <form onSubmit={handlePerformAdjust} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
              <strong className="text-slate-900 block font-semibold">
                {adjustCustomer.full_name || 'Anonymous'} ({adjustCustomer.phone})
              </strong>
              <div className="mt-1 flex items-center justify-between text-slate-600">
                <span>Current Balance:</span>
                <span className="font-bold text-brand-600">
                  {adjustCustomer.current_balance} {isStamps ? 'stamps' : 'points'}
                </span>
              </div>
            </div>

            {/* Credit or Debit Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Adjustment Action
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('ADD')}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    adjustType === 'ADD'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Credit / Bonus</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('DEDUCT')}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    adjustType === 'DEDUCT'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5 text-rose-600" />
                  <span>Debit / Correction</span>
                </button>
              </div>
            </div>

            {/* Points Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Amount ({isStamps ? 'Stamps' : 'Points'})
              </label>
              <input
                type="number"
                min="1"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            {/* Reason for Audit Log */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Audit Reason (Required)
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Compensation for wait time, promotion reward..."
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2 border border-emerald-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Balance successfully updated & audited in ledger!</span>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setAdjustCustomer(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isAdjusting}
              >
                Apply Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
