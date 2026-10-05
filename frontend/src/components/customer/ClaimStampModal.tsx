// ============================================================================
// File: frontend/src/components/customer/ClaimStampModal.tsx
// Description: Customer one-time stamp claim code modal for cashier verification
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Copy, Check, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { api } from '../../services/api.js';
import type { StampClaim } from '../../types/index.js';

interface ClaimStampModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName?: string;
  initialClaim?: StampClaim | null;
  currentStamps: number;
  targetStamps: number;
  onStampClaimedSuccess: (newStamps: number) => void;
}

export const ClaimStampModal: React.FC<ClaimStampModalProps> = ({
  isOpen,
  onClose,
  restaurantId,
  restaurantName = 'SA Dosa Cafe',
  initialClaim = null,
  currentStamps,
  targetStamps,
  onStampClaimedSuccess,
}) => {
  const [claim, setClaim] = useState<StampClaim | null>(initialClaim);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // 1. Fetch or generate code on open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function loadOrCreateClaim() {
      setLoading(true);
      setError(null);
      try {
        // Try getting active claim first
        const activeClaim = await api.getActiveStampClaim(restaurantId);
        if (!active) return;

        if (activeClaim) {
          setClaim(activeClaim as StampClaim);
        } else {
          // Generate new claim code
          const newClaim = await api.createStampClaim(restaurantId);
          if (!active) return;
          setClaim({
            id: newClaim.claim_id,
            code: newClaim.code,
            expires_at: newClaim.expires_at,
            status: newClaim.status as any,
          });
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Unable to generate claim code. Please ask cashier directly.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrCreateClaim();

    return () => {
      active = false;
    };
  }, [isOpen, restaurantId]);

  // 2. Countdown timer until expiry
  useEffect(() => {
    if (!claim?.expires_at) return;

    const interval = setInterval(() => {
      const remainingMs = new Date(claim.expires_at).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [claim?.expires_at]);

  // 3. Live polling: detect when cashier consumes code
  useEffect(() => {
    if (!isOpen || !claim?.code) return;

    const pollInterval = setInterval(async () => {
      try {
        const dashboard = await api.getDashboard(restaurantId);
        if (dashboard.loyalty_account.current_balance > currentStamps) {
          clearInterval(pollInterval);
          onStampClaimedSuccess(dashboard.loyalty_account.current_balance);
          onClose();
        }
      } catch {
        // Silent background poll error suppression
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [isOpen, claim?.code, restaurantId, currentStamps, onStampClaimedSuccess, onClose]);

  const handleCopyCode = () => {
    if (!claim?.code) return;
    navigator.clipboard.writeText(claim.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format code with pleasant spacing: e.g. "482 917"
  const formattedCode = claim?.code
    ? `${claim.code.slice(0, 3)} ${claim.code.slice(3)}`
    : '------';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Today's Stamp"
      maxWidth="sm"
    >
      <div className="flex flex-col items-center text-center space-y-4 py-2">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#FF6310] shadow-sm">
          <Sparkles className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
            YOUR CLAIM CODE
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Show this 6-digit code to the cashier at {restaurantName} to add your visit stamp.
          </p>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-3 border-[#FF6310] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Generating secure code...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        ) : (
          <>
            {/* The 6-Digit Code Display */}
            <div className="w-full bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 border-2 border-[#FF6310]/30 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                Cashier Verification Code
              </div>

              <div className="flex items-center justify-center gap-3 my-2">
                <span className="font-mono text-4xl sm:text-5xl font-black text-slate-900 tracking-widest drop-shadow-sm select-all">
                  {formattedCode}
                </span>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 bg-white/80 hover:bg-white rounded-xl shadow-xs border border-slate-200 text-slate-600 transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Expiry Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-xs rounded-full border border-amber-200 text-[11px] font-semibold text-amber-800 mt-1">
                <Clock className="w-3.5 h-3.5 text-[#FF6310]" />
                <span>Expires in: {timeLeft || '15:00'}</span>
              </div>
            </div>

            {/* Stamp Status Bar */}
            <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">Single-Use Security</span>
              </div>
              <span className="font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-full">
                Step {currentStamps} → {Math.min(currentStamps + 1, targetStamps)} of {targetStamps}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Your stamp will appear automatically as soon as the cashier enters your code.
            </p>
          </>
        )}

        <div className="w-full pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close Code
          </Button>
        </div>
      </div>
    </Modal>
  );
};
