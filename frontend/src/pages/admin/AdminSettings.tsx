// ============================================================================
// File: frontend/src/pages/admin/AdminSettings.tsx
// Description: Restaurant tenant profile, branding color customizer, and theme preview
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Palette,
  Check,
  AlertCircle,
  Save,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import { Button } from '../../components/common/Button.js';

export const AdminSettings: React.FC = () => {
  const { restaurant, loadRestaurantBySlug } = useRestaurant();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#d97706');
  const [accentColor, setAccentColor] = useState('#b45309');
  const [currency, setCurrency] = useState('USD');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setTagline(restaurant.tagline || '');
      setLogoUrl(restaurant.logo_url || '');
      setBrandColor(restaurant.brand_color || '#d97706');
      setAccentColor(restaurant.accent_color || '#b45309');
      setCurrency(restaurant.currency || 'USD');
    }
  }, [restaurant]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    try {
      setIsSaving(true);
      setError(null);
      await api.admin.updateRestaurant(restaurant.id, {
        name: name.trim(),
        tagline: tagline.trim() || null,
        logo_url: logoUrl.trim() || null,
        brand_color: brandColor.trim(),
        accent_color: accentColor.trim(),
        currency: currency.trim(),
      });

      // Update live CSS custom variables immediately
      document.documentElement.style.setProperty('--brand-primary', brandColor.trim());
      document.documentElement.style.setProperty('--brand-accent', accentColor.trim());

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadRestaurantBySlug(restaurant.slug);
    } catch (err: any) {
      console.error('Failed to update restaurant settings:', err);
      setError(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-400" />
            <span>Restaurant Profile & Branding</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customize your restaurant branding, colors, logos, and operational profile.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Changes
        </Button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Restaurant profile and brand styling saved successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Details */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Store className="w-4 h-4 text-brand-400" />
          <span>Restaurant Identity</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Restaurant Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Unique URL Slug
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={restaurant?.slug || ''}
                disabled
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Specialty coffee & fresh pastries"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Currency Code
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Logo Image URL (Optional)
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Brand Color Customizer & Live Card Preview */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-400" />
          <span>Brand Theme Colors & Card Preview</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Pickers */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Primary Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Accent Gradient Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Real-time Digital Card Preview */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Live Customer Card Preview
            </span>
            <div
              className="rounded-3xl p-5 text-white shadow-xl space-y-4 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${brandColor} 0%, ${accentColor} 100%)`,
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-base">{name || 'Your Restaurant'}</h4>
                  <span className="text-[11px] text-white/80 font-medium">Digital Loyalty Card</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-200" />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 block">Sample Balance</span>
                <span className="text-3xl font-extrabold">240 Points</span>
              </div>

              <div className="pt-2 border-t border-white/20 flex justify-between text-[11px] text-white/80 font-mono">
                <span>MEMBER #AC-100234</span>
                <span>Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
