// ============================================================================
// File: frontend/src/components/customer/ProfileSheet.tsx
// Description: Customer profile editor modal and account settings
// ============================================================================

import React, { useState } from 'react';
import { User, Phone, Mail, Calendar, LogOut, Check } from 'lucide-react';
import type { CustomerProfile } from '../../types/index.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { api } from '../../services/api.js';

interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CustomerProfile | null;
  onProfileUpdated: () => void;
  onLogout: () => void;
}

export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onLogout,
}) => {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [birthday, setBirthday] = useState(profile?.birthday || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await api.updateProfile({
        full_name: fullName.trim() || undefined,
        email: email.trim() || undefined,
        birthday: birthday || undefined,
      });
      setSuccessMsg(true);
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(false), 2500);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My Profile" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone (Immutable Identity) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Phone Number
          </label>
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 rounded-xl text-slate-600 text-sm border border-slate-200">
            <Phone className="w-4 h-4 text-slate-400" />
            <span className="font-mono">{profile?.phone || 'Not verified'}</span>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alice Walker"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        {/* Birthday */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Birthday (For bonus perks)
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-xl flex items-center gap-1.5 border border-emerald-200">
            <Check className="w-4 h-4" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <div className="pt-2 space-y-2.5">
          <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
            Save Changes
          </Button>

          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={() => {
              onLogout();
              onClose();
            }}
            leftIcon={<LogOut className="w-4 h-4 text-rose-500" />}
          >
            Log Out
          </Button>
        </div>
      </form>
    </Modal>
  );
};
