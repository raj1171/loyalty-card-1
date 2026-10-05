// ============================================================================
// File: frontend/src/components/customer/SeventhStampCelebrationModal.tsx
// Description: Celebration modal triggered when customer reaches 7/7 stamps
// ============================================================================

import React from 'react';
import { Award, Sparkles, Gift, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';

interface SeventhStampCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReward: () => void;
  restaurantName?: string;
  rewardTitle?: string;
}

export const SeventhStampCelebrationModal: React.FC<SeventhStampCelebrationModalProps> = ({
  isOpen,
  onClose,
  onViewReward,
  restaurantName = 'SA Dosa Cafe',
  rewardTitle = 'FREE REWARD',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="sm"
    >
      <div className="flex flex-col items-center text-center space-y-5 py-4 px-2">
        {/* Animated Celebration Badge */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FF6310] via-amber-500 to-amber-300 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 animate-bounce">
            <Gift className="w-10 h-10 stroke-[2.2]" />
          </div>
          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Milestone Title */}
        <div className="space-y-1">
          <span className="text-xs font-black tracking-widest text-[#FF6310] uppercase bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
            7 / 7 STAMPS COMPLETED
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-2">
            AMAZING! YOU DID IT! 🎉
          </h2>
          <p className="text-sm text-slate-600 max-w-xs mx-auto">
            You've collected all 7 stamps at {restaurantName}. Your exclusive loyalty reward is unlocked and ready to enjoy!
          </p>
        </div>

        {/* Reward Card Highlight */}
        <div className="w-full bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-100/50 border-2 border-amber-300/80 rounded-2xl p-4 text-left shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Unlocked Loyalty Perk
              </span>
              <span className="text-base font-extrabold text-slate-900 block leading-tight">
                {rewardTitle}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Redeemable at the counter with your cashier
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full space-y-2 pt-2">
          <Button
            variant="primary"
            className="w-full py-3 text-base font-bold bg-[#FF6310] hover:bg-[#E05307] shadow-md shadow-orange-500/25 flex items-center justify-center gap-2"
            onClick={() => {
              onClose();
              onViewReward();
            }}
          >
            <span>VIEW REWARD</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs text-slate-500"
            onClick={onClose}
          >
            I'll Redeem Later
          </Button>
        </div>
      </div>
    </Modal>
  );
};
