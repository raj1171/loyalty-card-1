// ============================================================================
// File: frontend/src/components/customer/RewardDetailModal.tsx
// Description: Reward details modal with server-verified redemption confirmation
// ============================================================================

import React, { useState } from 'react';
import { Gift, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Reward } from '../../types/index.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { api } from '../../services/api.js';

interface RewardDetailModalProps {
  reward: Reward | null;
  restaurantId: string;
  userBalance: number;
  loyaltyModel: 'POINTS' | 'STAMPS';
  isOpen: boolean;
  onClose: () => void;
  onRedeemed: (redemptionResult: any) => void;
}

export const RewardDetailModal: React.FC<RewardDetailModalProps> = ({
  reward,
  restaurantId,
  userBalance,
  loyaltyModel,
  isOpen,
  onClose,
  onRedeemed,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reward) return null;

  const unitLabel = loyaltyModel === 'POINTS' ? 'points' : 'stamps';
  const isEligible = userBalance >= reward.cost_points_stamps;
  const balanceAfter = userBalance - reward.cost_points_stamps;

  const handleRedeem = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Server-side atomic redemption
      const result = await api.redeemReward(reward.id, restaurantId);

      // Celebration confetti on confirmed server response
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback if canvas not available
      }

      onClose();
      onRedeemed(result);
    } catch (err: any) {
      console.error('Redemption error:', err);
      setError(err.message || 'Failed to redeem reward. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reward Details" maxWidth="md">
      <div className="space-y-5">
        {/* Reward Image / Icon */}
        <div className="w-full h-44 bg-brand-50/60 rounded-2xl flex items-center justify-center overflow-hidden border border-brand-100">
          {reward.image_url ? (
            <img
              src={reward.image_url}
              alt={reward.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Gift className="w-16 h-16 text-brand-500 stroke-[1.5]" />
          )}
        </div>

        {/* Title and Cost */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-extrabold text-slate-900">{reward.title}</h3>
            <Badge variant="brand" size="md">
              {reward.cost_points_stamps} {unitLabel}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {reward.description ||
              'Claim this special reward in-store using your loyalty points. Present your code to your server upon arrival.'}
          </p>
        </div>

        {/* Balance Cost Breakdown Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500 font-medium">
            <span>Your Current Balance</span>
            <span className="font-bold text-slate-700">{userBalance} {unitLabel}</span>
          </div>
          <div className="flex justify-between text-slate-500 font-medium">
            <span>Reward Cost</span>
            <span className="font-bold text-rose-600">-{reward.cost_points_stamps} {unitLabel}</span>
          </div>
          <div className="border-t border-slate-200/80 pt-2 flex justify-between font-bold text-slate-900 text-sm">
            <span>Balance After Redemption</span>
            <span className={balanceAfter >= 0 ? 'text-brand-600' : 'text-slate-400'}>
              {balanceAfter >= 0 ? `${balanceAfter} ${unitLabel}` : 'Insufficient balance'}
            </span>
          </div>
        </div>

        {/* Terms notice */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50/60 p-2.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Once redeemed, you will receive a single-use code valid for 15 minutes. Show this code to your server to claim your reward.
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {isEligible ? (
            <Button
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isSubmitting}
              onClick={handleRedeem}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Confirm & Redeem ({reward.cost_points_stamps} {unitLabel})
            </Button>
          ) : (
            <Button variant="secondary" fullWidth size="lg" disabled>
              Need {reward.cost_points_stamps - userBalance} more {unitLabel} to claim
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
