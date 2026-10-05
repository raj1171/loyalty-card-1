// ============================================================================
// File: frontend/src/pages/CashierVerifyPage.tsx
// Description: Dedicated cashier in-store stamp claim verification & fulfillment terminal
// ============================================================================

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  User,
  Award,
} from 'lucide-react';
import { SaDosaCafeLogo } from '../components/common/SaDosaCafeLogo.js';
import { api, setAuthToken } from '../services/api.js';
import type { Restaurant } from '../types/index.js';

interface CashierVerifyPageProps {
  restaurant: Restaurant;
  onExit?: () => void;
}

interface VerificationData {
  claim_id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  current_stamps: number;
  target_stamps: number;
  expires_at: string;
}

interface ConsumptionResult {
  customer_id: string;
  customer_name: string;
  previous_stamps: number;
  new_stamps: number;
  target_stamps: number;
  reward_unlocked: boolean;
  transaction_id: string;
}

export const CashierVerifyPage: React.FC<CashierVerifyPageProps> = ({
  restaurant,
  onExit,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States: 'input' -> 'verified' -> 'confirmed'
  const [step, setStep] = useState<'input' | 'verified' | 'confirmed'>('input');
  const [verifiedData, setVerifiedData] = useState<VerificationData | null>(null);
  const [consumeResult, setConsumeResult] = useState<ConsumptionResult | null>(null);

  // In demo environment, automatically ensure cashier staff session is available
  React.useEffect(() => {
    const initCashierSession = async () => {
      const existingToken = localStorage.getItem('loyalty_session_token');
      if (existingToken && !localStorage.getItem('loyalty_customer_session_backup')) {
        localStorage.setItem('loyalty_customer_session_backup', existingToken);
      }
      try {
        const auth = await api.verifyOtp('+15559990001', '123456', restaurant.id);
        if (auth.session_token) {
          setAuthToken(auth.session_token);
        }
      } catch (err) {
        console.warn('Could not auto-auth cashier:', err);
      }
    };
    initCashierSession();
  }, [restaurant.id]);

  const handleExit = () => {
    const backup = localStorage.getItem('loyalty_customer_session_backup');
    if (backup) {
      setAuthToken(backup);
      localStorage.removeItem('loyalty_customer_session_backup');
    }
    if (onExit) onExit();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter a valid 6-digit claim code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.staff.verifyStampClaim(restaurant.id, cleanCode);
      setVerifiedData(data);
      setStep('verified');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired claim code. Please check with customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStamp = async () => {
    if (!verifiedData) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.staff.consumeStampClaim(
        restaurant.id,
        verifiedData.code,
        'In-store cashier checkout'
      );
      setConsumeResult(result);
      setStep('confirmed');
    } catch (err: any) {
      setError(err.message || 'Failed to award stamp. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCode('');
    setVerifiedData(null);
    setConsumeResult(null);
    setError(null);
    setStep('input');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-slate-50 to-orange-50/30 flex flex-col items-center justify-between p-4 sm:p-6 text-slate-800">
      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between py-2 border-b border-amber-200/50">
        <SaDosaCafeLogo size="sm" variant="compact" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200/80">
            Cashier Mode
          </span>
          {onExit && (
            <button
              onClick={handleExit}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-white"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* Main Terminal Box */}
      <main className="w-full max-w-md my-auto py-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-200/70 p-6 sm:p-8 backdrop-blur-md">
          {/* STEP 1: Enter Customer Code */}
          {step === 'input' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF6310]">
                  Rapid Stamp Checkout
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Verify Customer Stamp
                </h1>
                <p className="text-xs text-slate-500">
                  Enter the 6-digit claim code shown on the customer's phone.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
                  Customer Claim Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={7}
                    placeholder="482 917"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full text-center font-mono text-3xl sm:text-4xl font-black tracking-widest py-3 px-4 rounded-2xl border-2 border-amber-200 focus:border-[#FF6310] focus:ring-4 focus:ring-orange-500/15 outline-none transition-all placeholder:text-slate-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Number Shortcuts / Presets */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (code.length < 6) setCode((prev) => prev + digit);
                    }}
                    className={`py-3 rounded-xl font-mono text-lg font-extrabold transition-all border border-slate-100 shadow-2xs active:scale-95 ${
                      digit === 0 ? 'col-span-3 bg-slate-50 hover:bg-slate-100 text-slate-800' : 'bg-slate-50 hover:bg-amber-50 text-slate-800'
                    }`}
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCode('')}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs transition-colors"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length < 4}
                  className="flex-1 py-3.5 bg-[#FF6310] hover:bg-[#E05307] disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md shadow-orange-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>VERIFY CODE</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Customer Preview & Confirm */}
          {step === 'verified' && verifiedData && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-extrabold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CUSTOMER FOUND ✓</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
                  Confirm Stamp Award
                </h2>
              </div>

              {/* Customer Card */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FF6310] text-white flex items-center justify-center font-black text-lg shadow-sm">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      Verified Member
                    </span>
                    <span className="text-lg font-black text-slate-900 block leading-tight">
                      {verifiedData.customer_name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {verifiedData.customer_phone || 'Phone verified'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Current Progress:</span>
                  <span className="font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
                    {verifiedData.current_stamps} / {verifiedData.target_stamps} Stamps
                  </span>
                </div>

                {/* +1 Stamp Impact Preview */}
                <div className="p-3 bg-white rounded-xl border-2 border-[#FF6310]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#FF6310]" />
                    <span className="font-extrabold text-sm text-slate-900">+1 Stamp for This Visit</span>
                  </div>
                  <span className="font-black text-base text-[#FF6310]">
                    → {verifiedData.current_stamps + 1} / {verifiedData.target_stamps}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStamp}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>CONFIRM & AWARD STAMP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Completed Celebration */}
          {step === 'confirmed' && consumeResult && (
            <div className="text-center space-y-6 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  TRANSACTION COMPLETED
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
                  ✓ STAMP CLAIMED!
                </h2>
                <p className="text-sm text-slate-600">
                  Successfully added to <strong>{consumeResult.customer_name}</strong>'s card.
                </p>
              </div>

              {/* Progress Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Customer New Balance
                </span>
                <div className="text-3xl font-black text-slate-900">
                  {consumeResult.new_stamps} / {consumeResult.target_stamps} Stamps
                </div>

                {consumeResult.reward_unlocked && (
                  <div className="mt-3 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-900 text-xs font-extrabold flex items-center justify-center gap-2">
                    <Award className="w-5 h-5 text-[#FF6310]" />
                    <span>🎉 7th STAMP REACHED! FREE REWARD UNLOCKED!</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-4 bg-[#FF6310] hover:bg-[#E05307] text-white font-black rounded-2xl shadow-md shadow-orange-500/30 text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>PROCESS NEXT CUSTOMER</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="text-center text-xs text-slate-400 py-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Cryptographically Verified In-Store Loyalty Terminal</span>
      </footer>
    </div>
  );
};
