// ============================================================================
// File: frontend/src/context/AuthContext.tsx
// Description: Customer authentication context managing OTP login and session state
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CustomerProfile } from '../types/index.js';
import { api, setAuthToken } from '../services/api.js';

interface AuthContextType {
  token: string | null;
  profile: CustomerProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithOtp: (phone: string, code: string, restaurantId?: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('loyalty_session_token'));
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.warn('Session expired or invalid profile:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const loginWithOtp = async (phone: string, code: string, restaurantId?: string, fullName?: string) => {
    const res = await api.verifyOtp(phone, code, restaurantId, fullName);
    setAuthToken(res.session_token);
    setTokenState(res.session_token);
    await fetchProfile();
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        profile,
        isAuthenticated: !!token,
        isLoading,
        loginWithOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
