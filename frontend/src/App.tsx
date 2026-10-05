// ============================================================================
// File: frontend/src/App.tsx
// Description: Main application router supporting Customer, Cashier Terminal,
//              and Merchant Admin Portal modes with SA Dosa Cafe pilot support
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { useRestaurant } from './context/RestaurantContext.js';
import { QRLandingPage } from './pages/QRLandingPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CashierVerifyPage } from './pages/CashierVerifyPage.js';
import { AdminPortal } from './pages/admin/AdminPortal.js';
import { Store, Shield, CheckCircle } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { restaurant, loadRestaurantBySlug } = useRestaurant();

  // Mode: 'customer' | 'cashier' | 'admin'
  const [mode, setMode] = useState<'customer' | 'cashier' | 'admin'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'cashier' || window.location.pathname.startsWith('/cashier')) {
      return 'cashier';
    }
    if (urlParams.get('mode') === 'admin' || window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'customer';
  });

  const [customerView, setCustomerView] = useState<'landing' | 'dashboard'>('landing');

  // Sync customer view with authentication status
  useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        setCustomerView('dashboard');
      } else {
        setCustomerView('landing');
      }
    }
  }, [isAuthenticated, isAuthLoading]);

  // Support demo tenant switcher in header bar
  const handleTenantSwitch = (slug: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('r', slug);
    window.history.pushState({}, '', url.toString());
    loadRestaurantBySlug(slug);
  };

  const handleToggleMode = (newMode: 'customer' | 'cashier' | 'admin') => {
    setMode(newMode);
    const url = new URL(window.location.href);
    if (newMode !== 'customer') {
      url.searchParams.set('mode', newMode);
    } else {
      url.searchParams.delete('mode');
    }
    window.history.pushState({}, '', url.toString());
  };

  // 1. Dedicated Cashier Verification Mode
  if (mode === 'cashier' && restaurant) {
    return (
      <CashierVerifyPage
        restaurant={restaurant}
        onExit={() => handleToggleMode('customer')}
      />
    );
  }

  // 2. Full Admin & Staff Portal Mode
  if (mode === 'admin') {
    return (
      <AdminPortal onSwitchToCustomerApp={() => handleToggleMode('customer')} />
    );
  }

  // 3. Customer Mobile Experience Mode
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Demo Toolbar (Tenant & Mode Switcher) */}
      <aside
        aria-label="Demo toolbar"
        className="bg-slate-900 text-slate-300 text-[11px] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 select-none"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Store className="w-3.5 h-3.5 text-[#FF6310]" />
          <span>
            Brand: <strong className="text-white">{restaurant?.name || 'Loading...'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tenant Switcher Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleTenantSwitch('sa-dosa-cafe')}
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                restaurant?.slug === 'sa-dosa-cafe'
                  ? 'bg-[#FF6310] text-white shadow-xs'
                  : 'hover:text-white text-slate-400'
              }`}
            >
              SA Dosa Cafe
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => handleTenantSwitch('artisan-coffee')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                restaurant?.slug === 'artisan-coffee'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'hover:text-white text-slate-400'
              }`}
            >
              Artisan
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => handleTenantSwitch('urban-bites')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                restaurant?.slug === 'urban-bites'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'hover:text-white text-slate-400'
              }`}
            >
              Urban Bites
            </button>
          </div>

          <span className="text-slate-700">|</span>

          {/* Quick Cashier Terminal Mode Toggle */}
          <button
            onClick={() => handleToggleMode('cashier')}
            className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Open In-Store Cashier Terminal"
          >
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Cashier Terminal</span>
          </button>

          {/* Switch to Merchant / Admin Portal Button */}
          <button
            onClick={() => handleToggleMode('admin')}
            className="px-2 py-0.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Open Owner & Manager Dashboard"
          >
            <Shield className="w-3 h-3 text-brand-400" />
            <span>Merchant Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Customer Screen */}
      <div className="flex-1">
        {customerView === 'dashboard' && isAuthenticated ? (
          <DashboardPage onBackToLanding={() => setCustomerView('landing')} />
        ) : (
          <QRLandingPage onAuthenticated={() => setCustomerView('dashboard')} />
        )}
      </div>
    </div>
  );
};

export default App;
