// ============================================================================
// File: frontend/src/components/admin/AdminLayout.tsx
// Description: Admin and merchant portal layout with sidebar and header
// ============================================================================

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Gift,
  Sliders,
  Receipt,
  CheckCircle,
  UserCheck,
  BarChart3,
  QrCode,
  Settings,
  Store,
  ExternalLink,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext.js';

export type AdminTab =
  | 'dashboard'
  | 'customers'
  | 'rewards'
  | 'rules'
  | 'transactions'
  | 'redemptions'
  | 'staff'
  | 'analytics'
  | 'qr'
  | 'settings';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onSwitchToCustomerApp: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'rules', label: 'Loyalty Rules', icon: Sliders },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'redemptions', label: 'Redemptions', icon: CheckCircle },
  { id: 'staff', label: 'Staff', icon: UserCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'qr', label: 'QR Management', icon: QrCode },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  onSwitchToCustomerApp,
  children,
}) => {
  const { restaurant, loadRestaurantBySlug } = useRestaurant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTenantSwitch = (slug: string) => {
    loadRestaurantBySlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('r', slug);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs"
            style={{ backgroundColor: restaurant?.brand_color || '#d97706' }}
          >
            {restaurant?.name.charAt(0) || 'R'}
          </div>
          <span className="font-bold text-sm text-white truncate max-w-[180px]">
            {restaurant?.name || 'Restaurant Portal'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchToCustomerApp}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <span>Customer View</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col
          transition-transform duration-200 ease-in-out md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand / Portal Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {restaurant?.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-9 h-9 rounded-xl object-cover bg-white p-0.5 border border-slate-700"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-md"
                  style={{ backgroundColor: restaurant?.brand_color || '#d97706' }}
                >
                  {restaurant?.name.charAt(0) || 'R'}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-white truncate">
                  {restaurant?.name || 'Loyalty Portal'}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Owner Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Switcher in Sidebar */}
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1.5">
              Active Tenant
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
              <button
                onClick={() => handleTenantSwitch('artisan-coffee')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  restaurant?.slug === 'artisan-coffee'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                Artisan
              </button>
              <button
                onClick={() => handleTenantSwitch('urban-bites')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  restaurant?.slug === 'urban-bites'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                Urban Bites
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all
                  ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }
                `}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / Switch to Customer View */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          <button
            onClick={onSwitchToCustomerApp}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Store className="w-4 h-4 text-brand-400" />
            <span>Open Customer App</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <p className="text-[10px] text-slate-500 text-center">
            Role: <strong>OWNER</strong> • Supabase RLS Active
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-900 min-h-screen overflow-x-hidden p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
