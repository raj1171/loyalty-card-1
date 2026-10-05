// ============================================================================
// File: frontend/src/components/auth/LoginModal.tsx
// Description: Customer phone OTP authentication and onboarding modal dialog
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { OtpInput } from './OtpInput.js';
import { useAuth } from '../../context/AuthContext.js';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { loginWithOtp } = useAuth();
  const { restaurant } = useRestaurant();

  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('+1');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();

    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      setError('Please enter a valid phone number (e.g. +15551234567)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await api.sendOtp(cleanPhone);
      setStep('OTP');
      setResendCountdown(60);
    } catch (err: any) {
      console.error('Failed to send OTP:', err);
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await loginWithOtp(phone.trim(), otp, restaurant?.id, fullName.trim() || undefined);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('OTP Verification failed:', err);
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    try {
      setIsLoading(true);
      setError(null);
      await api.sendOtp(phone.trim());
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('PHONE');
    setOtp('');
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={step === 'PHONE' ? 'Join Loyalty Rewards' : 'Enter Verification Code'}
      maxWidth="sm"
    >
      {step === 'PHONE' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="text-center pb-1">
            <p className="text-xs text-slate-500">
              Sign up or log in with your mobile number to view your loyalty card, earn points, and redeem rewards.
            </p>
          </div>

          {/* Full Name (Optional Onboarding) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alice Walker"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Mobile Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <span className="block text-[11px] text-slate-400 mt-1">
              Include country code (e.g. +1 for US/Canada)
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Send Verification Code
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure mobile authentication. No passwords needed.</span>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="text-center">
            <p className="text-xs text-slate-500">
              We sent a 6-digit code to <strong className="text-slate-800 font-mono">{phone}</strong>
            </p>
            <button
              type="button"
              onClick={() => setStep('PHONE')}
              className="text-xs font-semibold text-brand-600 hover:underline mt-1"
            >
              Change phone number
            </button>
          </div>

          {/* 6-Digit OTP Input */}
          <div className="py-2">
            <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isLoading}>
            Verify & Continue
          </Button>

          {/* Resend Timer */}
          <div className="text-center pt-1">
            {resendCountdown > 0 ? (
              <span className="text-xs text-slate-400 font-medium">
                Resend code in {resendCountdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center justify-center gap-1 mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resend Code</span>
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};
