export type ShelfId = 'rows' | 'columns' | 'color' | 'size' | 'filters';

export const SHELVES: { id: ShelfId; label: string }[] = [
  { id: 'rows', label: 'Lignes' },
  { id: 'columns', label: 'Colonnes' },
  { id: 'color', label: 'Couleur' },
  { id: 'size', label: 'Taille' },
  { id: 'filters', label: 'Filtres' },
];

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between';

export interface FilterValue {
  operator: FilterOperator;
  value: string;
  /** Only used for 'between'. */
  value2?: string;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'égal à',
  neq: 'différent de',
  gt: 'supérieur à',
  gte: 'supérieur ou égal à',
  lt: 'inférieur à',
  lte: 'inférieur ou égal à',
  contains: 'contient',
  between: 'entre',
};

/** Which comparisons make sense for a column's type — e.g. no "contient" on a date, no range on text. */
export function operatorsForDtype(dtype: ColumnType): FilterOperator[] {
  if (dtype === 'text') return ['eq', 'neq', 'contains'];
  if (dtype === 'boolean') return ['eq'];
  return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'];
}

export function defaultFilterValue(dtype: ColumnType): FilterValue {
  return { operator: operatorsForDtype(dtype)[0], value: '' };
}

export interface Field {
  id: string;
  tableName: string;
  columnName: string;
  dtype: ColumnType;
  /** Cosmetic display name, editable per column — falls back to columnName when unset. */
  label: string | null;
  /** Only meaningful when dtype === 'numeric' — set automatically (default "sum") once the field is placed on a shelf. */
  aggregation?: Aggregation;
  /** Only meaningful when placed on the "filters" shelf. */
  filter?: FilterValue;
}

export function displayLabel(field: Pick<Field, 'columnName' | 'label'>): string {
  return field.label ?? field.columnName;
}

export type ShelfAssignment = Record<ShelfId, Field[]>;

export const emptyShelfAssignment: ShelfAssignment = {
  rows: [],
  columns: [],
  color: [],
  size: [],
  filters: [],
};
