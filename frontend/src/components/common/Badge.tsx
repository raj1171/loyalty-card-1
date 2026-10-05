// ============================================================================
// File: frontend/src/components/common/Badge.tsx
// Description: Status and points badges
// ============================================================================

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'success' | 'warning' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  const variantStyles = {
    brand: 'bg-brand-50 text-brand-700 border border-brand-200/50',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/50',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200/50',
    outline: 'bg-transparent text-slate-600 border border-slate-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full whitespace-nowrap
        ${sizeStyles[size]}
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  );
};
