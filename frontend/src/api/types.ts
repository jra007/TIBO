/** What automatic cleanup did to a file before ingestion — see the nettoyage addendum. */
export interface CleaningReport {
  encoding: 'utf-8' | 'latin1';
  /** 0 = header already on the first row; >0 = that many leading rows were skipped. */
  headerRowIndex: number;
  droppedBlankColumns: string[];
}

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
  cleaningReport: CleaningReport | null;
}

export interface JournalEntry {
  id: string;
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
  importedAt: string;
  cleaningReport: CleaningReport | null;
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

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between';

export interface FilterCondition {
  tableName: string;
  columnName: string;
  operator: FilterOperator;
  value: string | null;
  value2?: string | null;
}

export interface ShelfDefinition {
  rows: FieldRef[];
  columns: FieldRef[];
  color: FieldRef[];
  size: FieldRef[];
  filters: FilterCondition[];
}

export type FormulaDtype = 'text' | 'numeric' | 'date' | 'boolean';

/** A field derived from a formula (see the view builder's "Champs calculés") — addressed on shelves via tableName '_calc' and columnName = this id. */
export interface CalculatedField {
  id: string;
  label: string;
  formula: string;
  dtype: FormulaDtype;
}

export const CALCULATED_FIELD_TABLE = '_calc';

export type QuickStatKind = 'percent_of_total' | 'variation' | 'running_total' | 'rank' | 'moving_average';

export const QUICK_STAT_LABELS: Record<QuickStatKind, string> = {
  percent_of_total: '% du total',
  variation: 'Variation vs période précédente (%)',
  running_total: 'Cumul (total cumulé)',
  rank: 'Rang',
  moving_average: 'Moyenne mobile',
};

export const QUICK_STAT_NEEDS_ORDER_FIELD: Record<QuickStatKind, boolean> = {
  percent_of_total: false,
  variation: true,
  running_total: true,
  rank: false,
  moving_average: true,
};

/** A one-click statistic (window function) computed from an already-placed field — see the view builder's right-click menu. Never placed on a shelf itself; always appended as an extra output column. */
export interface QuickStatField {
  id: string;
  label: string;
  kind: QuickStatKind;
  sourceField: FieldRef;
  /** Required for variation / running_total / moving_average — typically a date/time dimension already on rows or columns. */
  orderField?: FieldRef;
  /** Number of periods (inclusive of the current one) for moving_average. */
  windowSize?: number;
  /** Rank order — defaults to 'desc' (highest value = rank 1). */
  direction?: 'asc' | 'desc';
}

export const QUICK_STAT_TABLE = '_stat';

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
  calculatedFields: CalculatedField[];
  quickStatFields: QuickStatField[];
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
  'field:calculated:create',
  'field:calculated:edit',
  'field:calculated:share',
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
