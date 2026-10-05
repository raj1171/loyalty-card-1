// ============================================================================
// File: frontend/src/context/RestaurantContext.tsx
// Description: Context provider managing restaurant tenant branding and theme
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Restaurant, RestaurantSettings } from '../types/index.js';
import { api } from '../services/api.js';

interface RestaurantContextType {
  restaurant: Restaurant | null;
  settings: RestaurantSettings | null;
  isLoading: boolean;
  error: string | null;
  loadRestaurantBySlug: (slug: string) => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: React.ReactNode; initialSlug?: string }> = ({
  children,
  initialSlug = 'artisan-coffee',
}) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRestaurantBySlug = async (slug: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getRestaurantLanding(slug);
      setRestaurant(data.restaurant);
      setSettings(data.settings);

      // Dynamically apply restaurant brand colors to CSS variables
      if (data.restaurant.brand_color) {
        document.documentElement.style.setProperty('--brand-primary', data.restaurant.brand_color);
      }
      if (data.restaurant.accent_color) {
        document.documentElement.style.setProperty('--brand-accent', data.restaurant.accent_color);
      }
      document.title = `${data.restaurant.name} | Loyalty Rewards`;
    } catch (err: any) {
      console.error('Failed to load restaurant:', err);
      setError(err.message || 'Failed to load restaurant details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurantBySlug(initialSlug);
  }, [initialSlug]);

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        settings,
        isLoading,
        error,
        loadRestaurantBySlug,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}
