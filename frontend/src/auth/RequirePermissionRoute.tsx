import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission, type Permission } from './AuthContext';

/**
 * Client-side gate for UX only — the real enforcement against direct URL access
 * lives in the backend PermissionsGuard, which every admin endpoint requires.
 */
export function RequirePermissionRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  const granted = usePermission(permission);
  if (!granted) return <Navigate to="/" replace />;
  return <>{children}</>;
}
