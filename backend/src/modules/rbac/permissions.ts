export const PERMISSIONS = [
  'view:read',
  'view:create',
  'view:share',
  'export:pdf',
  'export:excel',
  'relation:validate',
  'settings:access',
  'settings:retention:edit',
  'settings:rbac:edit',
  'settings:reset:execute',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
