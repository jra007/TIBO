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
  'ingestion:manage',
  'settings:appearance:edit',
  'field:calculated:create',
  'field:calculated:edit',
  'field:calculated:share',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
