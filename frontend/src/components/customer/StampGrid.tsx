// ============================================================================
// File: frontend/src/components/customer/StampGrid.tsx
// Description: Visual 7-stamp grid with South Indian cafe styling and animations
// ============================================================================

import React from 'react';
import { Check, Sparkles, Gift } from 'lucide-react';

interface StampGridProps {
  currentStamps: number;
  targetStamps?: number;
  onClaimClick?: () => void;
  isClaimable?: boolean;
}

export const StampGrid: React.FC<StampGridProps> = ({
  currentStamps,
  targetStamps = 7,
  onClaimClick,
  isClaimable = true,
}) => {
  const slots = Array.from({ length: targetStamps }, (_, i) => i + 1);

  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-amber-100/80">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6310]" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Stamp Progress
          </span>
        </div>
        <span className="text-xs font-extrabold text-[#FF6310] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200/60 shadow-2xs">
          {currentStamps} of {targetStamps} Stamps
        </span>
      </div>

      {/* The 7 Stamp Slots */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
        {slots.map((num) => {
          const isCollected = num <= currentStamps;
          const isTargetMilestone = num === targetStamps;

          return (
            <div
              key={num}
              className={`
                relative aspect-square rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all duration-300
                ${
                  isCollected
                    ? 'bg-gradient-to-tr from-[#E05307] to-[#FF7A29] text-white shadow-md shadow-orange-500/25 scale-100 ring-2 ring-orange-300/60'
                    : isTargetMilestone
                    ? 'border-2 border-dashed border-amber-400 bg-amber-50/70 text-amber-700 animate-pulse'
                    : 'border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-amber-300'
                }
              `}
              title={`Stamp ${num} of ${targetStamps}`}
            >
              {isCollected ? (
                <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                  <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white stroke-[3.2]" />
                  </div>
                  <span className="text-[9px] font-black tracking-tight text-white/90 mt-0.5">
                    #{num}
                  </span>
                </div>
              ) : isTargetMilestone ? (
                <div className="flex flex-col items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-600" />
                  <span className="text-[9px] font-black text-amber-800 uppercase mt-0.5">
                    FREE!
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {/* Subtle Dosa Swirl Icon */}
                  <svg
                    className="w-4 h-4 text-slate-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 18c2-4 6-10 14-11 1.5-.5 2 1 1 2-5 5-9 9-13 11-1 .5-2-.5-2-2z" />
                    <path d="M12 4c0 0 1-1 0-2" />
                  </svg>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {num}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Helper or Claim CTA */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        {currentStamps >= targetStamps ? (
          <div className="w-full text-center text-xs font-black text-emerald-700 bg-emerald-50 py-2 px-3 rounded-xl border border-emerald-200 shadow-2xs">
            🎉 Reward Unlocked! Choose a reward below to redeem.
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-600 font-medium text-center sm:text-left">
              {`Collect ${targetStamps - currentStamps} more ${targetStamps - currentStamps === 1 ? 'stamp' : 'stamps'} to unlock your next reward.`}
            </div>

            {onClaimClick && isClaimable && (
              <button
                type="button"
                onClick={onClaimClick}
                className="w-full sm:w-auto px-4 py-2 bg-[#FF6310] hover:bg-[#E05307] text-white text-xs font-extrabold rounded-xl shadow-sm shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>CLAIM TODAY'S STAMP</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
