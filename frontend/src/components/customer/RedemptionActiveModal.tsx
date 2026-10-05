// ============================================================================
// File: frontend/src/components/customer/RedemptionActiveModal.tsx
// Description: Active redemption confirmation modal with QR code and live countdown
// ============================================================================

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, CheckCircle2, Copy, Check } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';

interface RedemptionActiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemption: {
    code: string;
    expires_at: string;
    reward_title?: string;
    points_cost?: number;
  } | null;
}

export const RedemptionActiveModal: React.FC<RedemptionActiveModalProps> = ({
  isOpen,
  onClose,
  redemption,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('15:00');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!redemption || !redemption.expires_at) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(redemption.expires_at).getTime();
      const diff = Math.max(0, expiry - now);

      if (diff === 0) {
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [redemption]);

  if (!redemption) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(redemption.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Redemption Pass" maxWidth="sm">
      <div className="flex flex-col items-center text-center space-y-4 py-1">
        {/* Success Icon */}
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
        </div>

        {/* Header */}
        <div>
          <h4 className="text-lg font-bold text-slate-900">
            {redemption.reward_title || 'Your Reward is Ready!'}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Present this single-use code to your server or cashier.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-md">
          <QRCodeSVG
            value={redemption.code}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Code Box with Copy */}
        <div className="w-full bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between">
          <div className="text-left">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Single-Use Code
            </span>
            <span className="font-mono text-lg font-extrabold text-slate-900 tracking-wider">
              {redemption.code}
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white rounded-xl border border-slate-200 shadow-xs active:scale-95 transition-all text-xs flex items-center gap-1"
            title="Copy Code"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Live Expiration Countdown */}
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200/60">
          <Clock className="w-3.5 h-3.5" />
          <span>Expires in: {timeLeft}</span>
        </div>

        <Button variant="secondary" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
};
