// ============================================================================
// File: frontend/src/components/customer/RewardCard.tsx
// Description: Customer reward item card with eligibility state
// ============================================================================

import React from 'react';
import { Gift, Lock, ChevronRight } from 'lucide-react';
import type { Reward } from '../../types/index.js';
import { Badge } from '../common/Badge.js';

interface RewardCardProps {
  reward: Reward;
  loyaltyModel: 'POINTS' | 'STAMPS';
  userBalance: number;
  onSelect: (reward: Reward) => void;
}

export const RewardCard: React.FC<RewardCardProps> = ({
  reward,
  loyaltyModel,
  userBalance,
  onSelect,
}) => {
  const isEligible = reward.cost_points_stamps <= userBalance;
  const difference = reward.cost_points_stamps - userBalance;
  const unitLabel = loyaltyModel === 'POINTS' ? 'pts' : 'stamps';

  return (
    <div
      onClick={() => onSelect(reward)}
      className={`
        group relative bg-white rounded-2xl p-4 border transition-all duration-200 cursor-pointer
        hover:shadow-md hover:border-slate-300 flex items-center gap-4 active:scale-[0.99]
        ${isEligible ? 'border-slate-200' : 'border-slate-100 opacity-80'}
      `}
    >
      {/* Icon / Image thumbnail */}
      <div
        className={`
          w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden
          ${isEligible ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}
        `}
      >
        {reward.image_url ? (
          <img
            src={reward.image_url}
            alt={reward.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Gift className="w-7 h-7 stroke-[1.75]" />
        )}
      </div>

      {/* Reward Details */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-brand-600 transition-colors">
          {reward.title}
        </h4>
        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
          {reward.description || 'Redeem with your loyalty balance.'}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant={isEligible ? 'brand' : 'neutral'} size="sm">
            {reward.cost_points_stamps} {unitLabel}
          </Badge>

          {isEligible ? (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              Ready to claim
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Need {difference} more
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-x-0.5 shrink-0" />
    </div>
  );
};
