// ============================================================================
// File: frontend/src/pages/admin/AdminRewards.tsx
// Description: Rewards catalog management and creator with expiry & limit controls
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Lock,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { Reward } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminRewards: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  // Form Fields
  const [title, setTitle] = useState('Free Coffee');
  const [description, setDescription] = useState('Enjoy a fresh artisanal espresso or brewed coffee on the house.');
  const [cost, setCost] = useState('100');
  const [expiryDays, setExpiryDays] = useState('30');
  const [customerLimit, setCustomerLimit] = useState('1'); // 1 per customer
  const [limitPeriod, setLimitPeriod] = useState<'MONTH' | 'TOTAL' | 'UNLIMITED'>('MONTH'); // 1/customer/month
  const [inventory, setInventory] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRewards = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const data = await api.admin.getRewards(restaurant.id);
      setRewards(data || []);
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [restaurant]);

  // Load reward into form for editing or reset to default
  const openCreateModal = () => {
    setEditingReward(null);
    setTitle('Free Coffee');
    setDescription('Enjoy a fresh artisanal espresso or brewed coffee on the house.');
    setCost('100');
    setExpiryDays('30');
    setCustomerLimit('1');
    setLimitPeriod('MONTH');
    setInventory('');
    setIsActive(true);
    setImageUrl('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward);
    setTitle(reward.title);
    setDescription(reward.description || '');
    setCost(reward.cost_points_stamps.toString());
    setExpiryDays('30');
    setCustomerLimit('1');
    setLimitPeriod('MONTH');
    setInventory('');
    setIsActive(reward.is_active ?? true);
    setImageUrl(reward.image_url || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFillExample = () => {
    setTitle('Free Coffee');
    setDescription('Enjoy a fresh artisanal espresso or brewed coffee on the house.');
    setCost('100');
    setExpiryDays('30');
    setCustomerLimit('1');
    setLimitPeriod('MONTH');
    setInventory('500');
    setIsActive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    const parsedCost = parseInt(cost, 10);
    if (isNaN(parsedCost) || parsedCost <= 0) {
      setFormError('Cost must be at least 1 point or stamp.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      // Compute valid_until if expiry days provided
      let validUntil: string | null = null;
      const days = parseInt(expiryDays, 10);
      if (!isNaN(days) && days > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        validUntil = expiryDate.toISOString();
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        cost_points_stamps: parsedCost,
        is_active: isActive,
        max_redemptions_per_customer:
          limitPeriod === 'UNLIMITED' ? null : parseInt(customerLimit, 10) || 1,
        total_inventory: inventory.trim() ? parseInt(inventory, 10) : null,
        valid_until: validUntil,
      };

      if (editingReward) {
        await api.admin.updateReward(restaurant.id, editingReward.id, payload);
      } else {
        await api.admin.createReward(restaurant.id, payload);
      }

      setIsModalOpen(false);
      fetchRewards();
    } catch (err: any) {
      console.error('Failed to save reward:', err);
      setFormError(err.message || 'Failed to save reward.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (!restaurant) return;
    if (!window.confirm('Are you sure you want to deactivate this reward?')) return;

    try {
      await api.admin.deleteReward(restaurant.id, rewardId);
      fetchRewards();
    } catch (err) {
      console.error('Failed to delete reward:', err);
    }
  };

  const isStamps = restaurant?.currency === 'STAMPS';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-brand-400" />
            <span>Rewards Catalog</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create and configure redeemable perks, point costs, customer redemption limits, and validity windows.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create New Reward</span>
        </button>
      </div>

      {/* Rewards Catalog Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-2xl bg-slate-800" />
          <Skeleton className="h-44 rounded-2xl bg-slate-800" />
          <Skeleton className="h-44 rounded-2xl bg-slate-800" />
        </div>
      ) : rewards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className={`bg-slate-800/80 border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                reward.is_active !== false
                  ? 'border-slate-700/80 hover:border-slate-600'
                  : 'border-slate-800 opacity-60'
              }`}
            >
              <div>
                {/* Header with Title & Active Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm line-clamp-1">
                        {reward.title}
                      </h3>
                      <span className="text-[11px] font-bold text-brand-400 font-mono">
                        {reward.cost_points_stamps} {isStamps ? 'stamps' : 'points'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      reward.is_active !== false
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {reward.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                  {reward.description || 'No description provided.'}
                </p>

                {/* Reward Meta Badges */}
                <div className="flex flex-wrap gap-2 mt-4 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>30 days expiry</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-1 rounded-lg">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>1/customer/mo</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditModal(reward)}
                  className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                  title="Edit Reward"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(reward.id)}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                  title="Deactivate Reward"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 text-xs bg-slate-800/40 rounded-2xl border border-slate-800">
          <Gift className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="font-bold text-white text-sm">No rewards created yet</p>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">
            Create attractive rewards for your customers such as free drinks, appetizers, or exclusive discounts.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={openCreateModal}>
              Create First Reward
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Reward Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReward ? 'Edit Reward' : 'Create New Reward'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Preset Filler */}
          {!editingReward && (
            <div className="bg-brand-500/10 border border-brand-500/30 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-slate-900">
                  Quick Example: Free Coffee (100 pts, 30 days, 1/mo)
                </span>
              </div>
              <button
                type="button"
                onClick={handleFillExample}
                className="text-[11px] font-bold text-brand-700 bg-white px-2.5 py-1 rounded-lg border border-brand-200 hover:bg-brand-50 transition-all"
              >
                Apply Preset
              </button>
            </div>
          )}

          {/* Reward Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reward Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Free Coffee"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* Cost and Expiry Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cost ({isStamps ? 'Stamps' : 'Points'}) *
              </label>
              <input
                type="number"
                min="1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Expiry Period (Days)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  placeholder="30"
                  className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                  days
                </span>
              </div>
            </div>
          </div>

          {/* Customer Limit Rule */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Redemption Frequency Limit
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLimitPeriod('MONTH')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  limitPeriod === 'MONTH'
                    ? 'bg-brand-50 text-brand-700 border-brand-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                1 / Customer / Month
              </button>

              <button
                type="button"
                onClick={() => setLimitPeriod('TOTAL')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  limitPeriod === 'TOTAL'
                    ? 'bg-brand-50 text-brand-700 border-brand-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                1 / Customer Lifetime
              </button>

              <button
                type="button"
                onClick={() => setLimitPeriod('UNLIMITED')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  limitPeriod === 'UNLIMITED'
                    ? 'bg-brand-50 text-brand-700 border-brand-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Unlimited
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Any standard latte, cappuccino, or cold brew beverage..."
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* Total Inventory & Active Toggle */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Total Inventory (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="Unlimited if empty"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded-md focus:ring-brand-500"
                />
                <span className="text-xs font-bold text-slate-700">Active & Claimable</span>
              </label>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
            >
              {editingReward ? 'Update Reward' : 'Publish Reward'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
