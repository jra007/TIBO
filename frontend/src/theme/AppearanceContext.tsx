import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AppearanceSettings } from '../api/types';
import { applyAppearance } from './apply-appearance';

interface AppearanceContextValue {
  appearance: AppearanceSettings | null;
  refresh: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

/** Fetched once at the app root, before any auth check — the login page needs branding too, and GET /appearance requires no token. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null);

  async function refresh() {
    const settings = await apiClient.get<AppearanceSettings>('/appearance');
    applyAppearance(settings);
    setAppearance(settings);
  }

  useEffect(() => {
    refresh();
  }, []);

  return <AppearanceContext.Provider value={{ appearance, refresh }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider');
  return ctx;
}
