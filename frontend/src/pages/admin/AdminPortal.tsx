// ============================================================================
// File: frontend/src/pages/admin/AdminPortal.tsx
// Description: Master Merchant & Owner Portal switching across all 10 management views
// ============================================================================

import React, { useState } from 'react';
import { AdminLayout, type AdminTab } from '../../components/admin/AdminLayout.js';
import { AdminDashboard } from './AdminDashboard.js';
import { AdminCustomers } from './AdminCustomers.js';
import { AdminRewards } from './AdminRewards.js';
import { AdminLoyaltyRules } from './AdminLoyaltyRules.js';
import { AdminTransactions } from './AdminTransactions.js';
import { AdminRedemptions } from './AdminRedemptions.js';
import { AdminStaff } from './AdminStaff.js';
import { AdminAnalytics } from './AdminAnalytics.js';
import { AdminQrManagement } from './AdminQrManagement.js';
import { AdminSettings } from './AdminSettings.js';

interface AdminPortalProps {
  onSwitchToCustomerApp: () => void;
  initialTab?: AdminTab;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onSwitchToCustomerApp,
  initialTab = 'dashboard',
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);

  return (
    <AdminLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      onSwitchToCustomerApp={onSwitchToCustomerApp}
    >
      {currentTab === 'dashboard' && <AdminDashboard onNavigateTab={setCurrentTab} />}
      {currentTab === 'customers' && <AdminCustomers />}
      {currentTab === 'rewards' && <AdminRewards />}
      {currentTab === 'rules' && <AdminLoyaltyRules />}
      {currentTab === 'transactions' && <AdminTransactions />}
      {currentTab === 'redemptions' && <AdminRedemptions />}
      {currentTab === 'staff' && <AdminStaff />}
      {currentTab === 'analytics' && <AdminAnalytics />}
      {currentTab === 'qr' && <AdminQrManagement />}
      {currentTab === 'settings' && <AdminSettings />}
    </AdminLayout>
  );
};
export default AdminPortal;
