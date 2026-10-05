// ============================================================================
// File: frontend/src/components/common/Skeleton.tsx
// Description: Shimmer loading skeletons for mobile cards and lists
// ============================================================================

import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
};

export const LoyaltyCardSkeleton: React.FC = () => {
  return (
    <div className="w-full h-48 bg-slate-200 animate-pulse rounded-3xl p-6 flex flex-col justify-between shadow-sm">
      <div className="flex justify-between items-start">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-12 h-6 rounded-full" />
      </div>
      <div>
        <Skeleton className="w-20 h-4 mb-2" />
        <Skeleton className="w-40 h-10" />
      </div>
      <div className="flex justify-between items-end">
        <Skeleton className="w-28 h-4" />
        <Skeleton className="w-16 h-8 rounded-lg" />
      </div>
    </div>
  );
};

export const RewardCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 flex gap-4 items-center">
      <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-3/4 h-5" />
        <Skeleton className="w-1/2 h-4" />
        <Skeleton className="w-24 h-6 rounded-full" />
      </div>
    </div>
  );
};
