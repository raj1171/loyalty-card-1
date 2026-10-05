// ============================================================================
// File: frontend/src/components/customer/TransactionItem.tsx
// Description: Individual loyalty ledger transaction row with points delta
// ============================================================================

import React from 'react';
import { Coffee, Gift, Sparkles, ShoppingBag, ArrowDownRight } from 'lucide-react';
import type { LoyaltyTransaction } from '../../types/index.js';

interface TransactionItemProps {
  transaction: LoyaltyTransaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const isCredit = transaction.points_stamps > 0;

  const getIcon = () => {
    switch (transaction.type) {
      case 'PURCHASE':
      case 'VISIT':
        return <Coffee className="w-4 h-4 text-amber-600" />;
      case 'BONUS':
      case 'BIRTHDAY':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'REWARD_REDEMPTION':
        return <ArrowDownRight className="w-4 h-4 text-rose-600" />;
      case 'REFERRAL':
        return <Gift className="w-4 h-4 text-brand-600" />;
      default:
        return <ShoppingBag className="w-4 h-4 text-slate-600" />;
    }
  };

  const formattedDate = new Date(transaction.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-none">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isCredit ? 'bg-amber-50' : 'bg-slate-100'
          }`}
        >
          {getIcon()}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {transaction.description}
          </p>
          <span className="text-[11px] text-slate-400">{formattedDate}</span>
        </div>
      </div>

      <div className="text-right shrink-0 ml-3">
        <span
          className={`text-sm font-extrabold ${
            isCredit ? 'text-emerald-600' : 'text-slate-800'
          }`}
        >
          {isCredit ? `+${transaction.points_stamps}` : transaction.points_stamps}
        </span>
        <span className="block text-[10px] text-slate-400">
          bal: {transaction.balance_after}
        </span>
      </div>
    </div>
  );
};
