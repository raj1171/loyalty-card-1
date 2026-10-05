import React from 'react';

interface SaDosaCafeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  variant?: 'full' | 'compact' | 'mark-only';
  inverted?: boolean;
  className?: string;
}

export const SaDosaCafeLogo: React.FC<SaDosaCafeLogoProps> = ({
  size = 'md',
  variant = 'full',
  inverted = false,
  className = '',
}) => {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { iconSize: 28, textClass: 'text-sm font-bold', subTextClass: 'text-[9px]' };
      case 'lg':
        return { iconSize: 48, textClass: 'text-xl font-extrabold', subTextClass: 'text-xs' };
      case 'hero':
        return { iconSize: 64, textClass: 'text-2xl md:text-3xl font-black', subTextClass: 'text-xs tracking-widest' };
      case 'md':
      default:
        return { iconSize: 36, textClass: 'text-base font-extrabold', subTextClass: 'text-[10px]' };
    }
  };

  const { iconSize, textClass, subTextClass } = getDimensions();

  // Primary palette: Saffron #FF6310, Gold #F59E0B, Leaf Green #059669
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Visual Brand Mark: Hot crispy dosa swirl with aromatic steam and leaf leaf accent */}
      <div
        className="relative flex items-center justify-center rounded-2xl shadow-md transition-transform hover:scale-105"
        style={{
          width: iconSize,
          height: iconSize,
          background: 'linear-gradient(135deg, #FF6310 0%, #E05307 60%, #9A3412 100%)',
          boxShadow: '0 4px 14px rgba(255, 99, 16, 0.35)',
        }}
        aria-label="SA Dosa Cafe Logo Mark"
      >
        <svg
          viewBox="0 0 40 40"
          width={iconSize * 0.75}
          height={iconSize * 0.75}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Crispy Golden Dosa Cone / Roll */}
          <path
            d="M8 28C10 24 16 14 30 11C32 10.5 33 12.5 31.5 14C24 21.5 17 28 11 31C9 32 7.5 30 8 28Z"
            fill="#FEF3C7"
            stroke="#FDE68A"
            strokeWidth="1.2"
          />
          {/* Inner Golden Roasted Fill */}
          <path
            d="M13 25C17 20 22 16 28 14C23 20 18 25 13 25Z"
            fill="#F59E0B"
            opacity="0.85"
          />
          {/* Aromatic Steam Waves */}
          <path
            d="M20 7C20 7 21 5 20 3M25 8C25 8 26.5 6 25.5 4"
            stroke="#FFF8F0"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* South Indian Banana Leaf Accent Dot */}
          <circle cx="30" cy="27" r="3" fill="#10B981" stroke="#FFF" strokeWidth="1" />
        </svg>
      </div>

      {/* Typography */}
      {variant !== 'mark-only' && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`${textClass} tracking-tight uppercase ${
                inverted ? 'text-white' : 'text-slate-900'
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              SA <span style={{ color: '#FF6310' }}>DOSA</span> CAFE
            </span>
          </div>

          {variant === 'full' && (
            <span
              className={`${subTextClass} font-semibold uppercase mt-0.5 tracking-wider ${
                inverted ? 'text-amber-200' : 'text-amber-700'
              }`}
            >
              Eat • Collect • Enjoy
            </span>
          )}
        </div>
      )}
    </div>
  );
};
