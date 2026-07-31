export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  permissions: string[];
}

export interface Session {
  token: string;
  user: SessionUser;
}

const STORAGE_KEY = 'tibo.session';

export function loadSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
