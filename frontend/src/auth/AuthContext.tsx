import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import { clearSession, loadSession, saveSession, type Session } from './session';

export type Permission =
  | 'view:read'
  | 'view:create'
  | 'view:share'
  | 'export:pdf'
  | 'export:excel'
  | 'relation:validate'
  | 'settings:access'
  | 'settings:retention:edit'
  | 'settings:rbac:edit';

interface AuthContextValue {
  session: Session | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  async function login(username: string, password: string) {
    const result = await apiClient.post<Session>('/auth/login', { username, password });
    saveSession(result);
    setSession(result);
  }

  function logout() {
    clearSession();
    setSession(null);
  }

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function usePermission(permission: Permission): boolean {
  return useAuth().session?.user.permissions.includes(permission) ?? false;
}
