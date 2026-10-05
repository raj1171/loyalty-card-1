// ============================================================================
// File: frontend/src/pages/admin/AdminRedemptions.tsx
// Description: Staff redemption verification, fulfillment scanner, and redemption logs
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { AdminRedemption } from '../../types/index.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminRedemptions: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // In-Store Verification Form
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Fulfillment Form
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [fulfillSuccess, setFulfillSuccess] = useState<string | null>(null);

  const fetchRedemptions = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const res = await api.admin.getRedemptions(
        restaurant.id,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setRedemptions(res.redemptions || []);
    } catch (err) {
      console.error('Failed to fetch redemptions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, [restaurant, statusFilter]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !verifyCode.trim()) return;

    try {
      setIsVerifying(true);
      setVerifyError(null);
      setVerificationResult(null);
      setFulfillSuccess(null);

      const result = await api.staff.verifyRedemption(restaurant.id, verifyCode.trim());
      setVerificationResult(result);
    } catch (err: any) {
      console.error('Verification failed:', err);
      setVerifyError(err.message || 'Invalid redemption code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFulfill = async () => {
    if (!restaurant || !verificationResult) return;

    try {
      setIsFulfilling(true);
      setVerifyError(null);
      await api.staff.fulfillRedemption(
        restaurant.id,
        verificationResult.code,
        fulfillNotes.trim() || undefined
      );

      setFulfillSuccess(`Reward successfully fulfilled for ${verificationResult.customer_name || 'customer'}!`);
      setVerificationResult(null);
      setVerifyCode('');
      setFulfillNotes('');
      fetchRedemptions();
    } catch (err: any) {
      console.error('Fulfillment error:', err);
      setVerifyError(err.message || 'Failed to fulfill redemption.');
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-brand-400" />
            <span>Reward Redemptions & Verification</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scan and verify customer single-use codes (RD-XXXX-XXXX) and review redemption logs.
          </p>
        </div>

        <button
          onClick={fetchRedemptions}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Staff In-Store Verification Card */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            In-Store Code Scanner & Verifier
          </h3>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
              placeholder="Enter customer code: RD-XXXX-XXXX"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-bold text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 outline-none uppercase tracking-wider"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isVerifying}
            leftIcon={<Search className="w-4 h-4" />}
          >
            Verify Code
          </Button>
        </form>

        {verifyError && (
          <div className="p-3.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {fulfillSuccess && (
          <div className="p-3.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{fulfillSuccess}</span>
          </div>
        )}

        {/* Verification Result Box */}
        {verificationResult && (
          <div className="bg-slate-900/90 border border-slate-700 p-5 rounded-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Verified Reward
                </span>
                <h4 className="text-lg font-extrabold text-white mt-0.5">
                  {verificationResult.reward_title}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Customer: <strong>{verificationResult.customer_name || 'Member'}</strong> (
                  {verificationResult.customer_phone})
                </p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  verificationResult.is_valid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {verificationResult.is_valid ? 'VALID PASS' : 'INVALID'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Code</span>
                <span className="font-mono font-bold text-brand-400">{verificationResult.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Cost</span>
                <span className="font-bold text-slate-200">{verificationResult.points_cost} pts</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Expires At</span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {new Date(verificationResult.expires_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {verificationResult.is_valid ? (
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  value={fulfillNotes}
                  onChange={(e) => setFulfillNotes(e.target.value)}
                  placeholder="Optional fulfillment notes (e.g. Table #4, Extra shot)"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 outline-none"
                />

                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  isLoading={isFulfilling}
                  onClick={handleFulfill}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm & Fulfill Reward (Deliver Item)
                </Button>
              </div>
            ) : (
              <p className="text-xs text-rose-400 italic">
                {verificationResult.validity_reason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Redemptions History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Redemption History Log
          </h3>

          <div className="flex gap-1.5 text-xs font-bold">
            {['ALL', 'ISSUED', 'REDEEMED', 'EXPIRED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-brand-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
              <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            </div>
          ) : redemptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Reward</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Cost</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Issued At</th>
                    <th className="py-3.5 px-4">Redeemed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {redemptions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-400 text-sm">
                        {r.code}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-white">
                        {r.reward_title}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-white block font-medium">
                          {r.customer_name || 'Member'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{r.customer_phone}</span>
                      </td>

                      <td className="py-3.5 px-4 font-bold font-mono">
                        {r.points_cost} pts
                      </td>

                      <td className="py-3.5 px-4">
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
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(r.issued_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {r.redeemed_at
                          ? new Date(r.redeemed_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 text-xs">
              No redemptions found for this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
