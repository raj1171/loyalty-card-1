// ============================================================================
// File: frontend/src/components/customer/DigitalLoyaltyCard.tsx
// Description: Dynamic mobile digital loyalty card with SA Dosa Cafe branding
// ============================================================================

import React, { useState } from 'react';
import { QrCode, Sparkles, Award } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Restaurant, LoyaltyAccount, CustomerMembership } from '../../types/index.js';
import { StampGrid } from './StampGrid.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { SaDosaCafeLogo } from '../common/SaDosaCafeLogo.js';

interface DigitalLoyaltyCardProps {
  restaurant: Restaurant;
  loyaltyAccount: LoyaltyAccount;
  membership: CustomerMembership;
  targetStamps?: number;
  onClaimClick?: () => void;
}

export const DigitalLoyaltyCard: React.FC<DigitalLoyaltyCardProps> = ({
  restaurant,
  loyaltyAccount,
  membership,
  targetStamps = 7,
  onClaimClick,
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const isStamps = loyaltyAccount.loyalty_model === 'STAMPS';
  const isSaDosaCafe =
    restaurant.slug === 'sa-dosa-cafe' ||
    restaurant.name.toLowerCase().includes('dosa');

  // Primary brand gradient (saffron orange to warm terracotta dark)
  const bgGradient =
    isSaDosaCafe
      ? 'linear-gradient(135deg, #FF6310 0%, #D84F05 50%, #9A3412 100%)'
      : `linear-gradient(135deg, ${restaurant.brand_color || '#d97706'} 0%, ${
          restaurant.accent_color || '#b45309'
        } 100%)`;

  return (
    <>
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-xl text-white p-5 sm:p-6 transition-all duration-300 transform hover:scale-[1.01]"
        style={{ background: bgGradient }}
      >
        {/* Subtle decorative background watermarks */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-black/15 rounded-full blur-xl pointer-events-none" />

        {/* Card Header: Brand Logo & Show QR */}
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="flex items-center gap-2">
            {isSaDosaCafe ? (
              <SaDosaCafeLogo size="md" variant="full" inverted={true} />
            ) : (
              <div>
                <h2 className="text-xl font-extrabold tracking-tight drop-shadow-sm">
                  {restaurant.name}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>Digital Loyalty Member</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowQrModal(true)}
            className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
            title="Show Member QR"
            aria-label="Show Membership QR Code"
          >
            <QrCode className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Balance / Stamp Grid Display */}
        {!isStamps ? (
          <div className="my-4 relative z-10">
            <span className="text-xs uppercase tracking-wider text-white/80 font-semibold">
              Available Balance
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight drop-shadow-sm">
                {loyaltyAccount.current_balance}
              </span>
              <span className="text-lg font-bold text-white/90">Points</span>
            </div>
          </div>
        ) : (
          <div className="my-2 relative z-10">
            <StampGrid
              currentStamps={loyaltyAccount.current_balance}
              targetStamps={targetStamps}
              onClaimClick={onClaimClick}
              isClaimable={true}
            />
          </div>
        )}

        {/* Card Footer: Membership Number & Stats */}
        <div className="flex justify-between items-end pt-3 border-t border-white/20 mt-4 relative z-10 text-xs">
          <div>
            <span className="block text-white/70 text-[10px] uppercase font-semibold">
              Member ID
            </span>
            <span className="font-mono font-bold tracking-wider text-white/95">
              {membership.membership_number}
            </span>
          </div>

          <div className="text-right">
            <span className="block text-white/70 text-[10px] uppercase font-semibold">
              Total Accrued
            </span>
            <span className="font-semibold text-white/95 flex items-center justify-end gap-1">
              <Award className="w-3.5 h-3.5 text-amber-300" />
              {loyaltyAccount.lifetime_accrued} {isStamps ? 'stamps' : 'pts'}
            </span>
          </div>
        </div>
      </div>

      {/* Membership QR Modal */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Your Loyalty Card QR"
        maxWidth="sm"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <p className="text-sm text-slate-500">
            Show this QR code to your cashier or server to earn stamps with your order.
          </p>

          <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
            <QRCodeSVG
              value={membership.membership_number}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="bg-slate-50 px-4 py-2 rounded-xl w-full border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Membership Number
            </span>
            <span className="font-mono text-base font-bold text-slate-800 tracking-wider">
              {membership.membership_number}
            </span>
          </div>

          <Button
            variant="secondary"
            className="w-full mt-2"
            onClick={() => setShowQrModal(false)}
          >
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
};
