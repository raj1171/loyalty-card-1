// ============================================================================
// File: frontend/src/pages/admin/AdminStaff.tsx
// Description: Multi-tenant RBAC staff team management and staff invitation
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Shield,
  Mail,
  User,
  AlertCircle,
  Key,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { StaffMember } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminStaff: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'STAFF' | 'MANAGER' | 'OWNER'>('STAFF');
  const [userId, setUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const data = await api.admin.getStaff(restaurant.id);
      setStaffList(data || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [restaurant]);

  const handleOpenInvite = () => {
    setEmail('');
    setFullName('');
    setRole('STAFF');
    // Generate deterministic UUID for demo testing
    setUserId(crypto.randomUUID());
    setError(null);
    setIsInviteOpen(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await api.admin.inviteStaff(restaurant.id, {
        user_id: userId,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
      });

      setIsInviteOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error('Failed to invite staff member:', err);
      setError(err.message || 'Failed to add staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-400" />
            <span>Staff & Permission Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage authenticated cashiers, shift managers, and restaurant owners under strict RBAC.
          </p>
        </div>

        <button
          onClick={handleOpenInvite}
          className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
          </div>
        ) : staffList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-700/80">
                <tr>
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Permissions</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                          {s.full_name ? s.full_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <strong className="text-white block font-semibold">{s.full_name}</strong>
                          <span className="text-[11px] text-slate-400 font-mono">{s.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.role === 'OWNER'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : s.role === 'MANAGER'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>{s.role}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {s.role === 'OWNER'
                        ? 'Full tenant administration & staff invites'
                        : s.role === 'MANAGER'
                        ? 'Catalog CRUD, rules & analytics'
                        : 'POS visit recording & code fulfillment'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        Active
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400 text-xs">
            No staff members found.
          </div>
        )}
      </div>

      {/* Role Matrix Card */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 text-xs text-slate-400 space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Multi-Tenant RBAC Security Model
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 space-y-1">
            <strong className="text-blue-400 block font-bold">STAFF (Cashier)</strong>
            <p className="text-[11px]">Can verify single-use codes, fulfill rewards, and record visits.</p>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 space-y-1">
            <strong className="text-purple-400 block font-bold">MANAGER</strong>
            <p className="text-[11px]">Can create/edit rewards, adjust customer points, and view analytics.</p>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 space-y-1">
            <strong className="text-amber-400 block font-bold">OWNER</strong>
            <p className="text-[11px]">Complete control over restaurant profile, loyalty rules, and team invites.</p>
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Add Staff Member"
        maxWidth="sm"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Marcus Vance"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marcus@restaurant.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              System Role *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['STAFF', 'MANAGER', 'OWNER'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                    role === r
                      ? 'bg-brand-50 text-brand-700 border-brand-300'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              User UUID
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <span className="block text-[10px] text-slate-400 mt-1">
              Auth User ID assigned to this staff account.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
            >
              Save Staff Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
