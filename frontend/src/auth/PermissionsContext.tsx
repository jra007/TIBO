import { createContext, useContext, type ReactNode } from 'react';

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

const PermissionsContext = createContext<Permission[]>([]);

export function PermissionsProvider({ permissions, children }: { permissions: Permission[]; children: ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermission(permission: Permission): boolean {
  return useContext(PermissionsContext).includes(permission);
}
