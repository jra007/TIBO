export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error';
  errors: string[];
}

export interface JournalEntry {
  id: string;
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error';
  errors: string[];
  importedAt: string;
}

export type RelationStatus = 'proposed' | 'validated' | 'rejected';

export interface DetectedRelation {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidenceScore: number;
  status: RelationStatus;
  validatedBy?: string;
  validatedAt?: string;
  createdAt: string;
}

export interface UploadResponse {
  imports: IngestionResult[];
  relations: DetectedRelation[];
}

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';

export interface TableSchema {
  tableName: string;
  columns: { columnName: string; dtype: ColumnType; label: string | null }[];
}

export type ChartType = 'bar' | 'line' | 'scatter' | 'heatmap' | 'table' | 'geo';
export type ViewVisibility = 'private' | 'shared';
export type ViewRelationStatus = 'validated' | 'pending' | 'to_fix';

export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface FieldRef {
  tableName: string;
  columnName: string;
  aggregation?: Aggregation;
}

export interface ShelfDefinition {
  rows: FieldRef[];
  columns: FieldRef[];
  color: FieldRef[];
  size: FieldRef[];
  filters: FieldRef[];
}

export interface ViewData {
  headers: string[];
  headerLabels: string[];
  rows: Record<string, unknown>[];
}

export interface SavedView {
  id: string;
  ownerId: string;
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  relationStatus: ViewRelationStatus;
  createdAt: string;
}

export interface Dashboard {
  id: string;
  ownerId: string;
  name: string;
  viewIds: string[];
  layout: unknown;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  status: 'active' | 'inactive';
}

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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RetentionUnit = 'hours' | 'days' | 'months' | 'years';
export type RetentionStatus = 'active' | 'legal_hold';

export interface RetentionPolicy {
  dataType: string;
  duration: number;
  unit: RetentionUnit;
  status: RetentionStatus;
}

export interface LdapSettings {
  enabled: boolean;
  url: string;
  bindDn: string;
  hasBindPassword: boolean;
  baseDn: string;
  searchFilter: string;
  usernameAttribute: string;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number | null;
  timeoutMs: number | null;
}

export interface AuthSettings {
  ldap: LdapSettings;
}

/** ldap.bindPassword: omit = leave unchanged, '' = clear, value = replace. */
export interface UpdateAuthSettingsInput {
  ldap: Omit<LdapSettings, 'hasBindPassword'> & { bindPassword?: string };
}

export interface LdapTestResult {
  success: boolean;
  message: string;
}

export interface SmtpSettings {
  host: string;
  port: number | null;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  fromAddress: string;
  requireTLS: boolean;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number | null;
  greetingTimeoutMs: number | null;
  socketTimeoutMs: number | null;
}

/** password: omit = leave unchanged, '' = clear, value = replace. */
export interface UpdateSmtpSettingsInput extends Omit<SmtpSettings, 'hasPassword'> {
  password?: string;
}

export interface SmtpTestResult {
  success: boolean;
  message: string;
}

export interface AppearanceSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  title: string | null;
  primaryColor: string | null;
  backgroundColor: string | null;
}

/** Any field omitted = unchanged; explicit null = reset to default. */
export interface UpdateAppearanceSettingsInput {
  logoFileId?: string | null;
  faviconFileId?: string | null;
  title?: string | null;
  primaryColor?: string | null;
  backgroundColor?: string | null;
}

export interface UploadedFileMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface AuthMethodsStatus {
  local: true;
  ldap: boolean;
}
