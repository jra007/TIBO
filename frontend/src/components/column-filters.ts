import type { ColumnType, FilterValue } from '../pages/view-builder/shelves';

export interface FilterableField {
  tableName: string;
  columnName: string;
  dtype: ColumnType;
  label: string;
}

export interface ActiveColumnFilter extends FilterableField {
  filter: FilterValue;
}

export function filterStorageKey(viewId: string): string {
  return `tibo:view-filters:${viewId}`;
}

/** Per-viewer filter preference, not part of the saved view — kept in this browser only, same as chart-presentation.ts's chart type. */
export function loadStoredFilters(key: string): ActiveColumnFilter[] {
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is ActiveColumnFilter =>
        f != null &&
        typeof f === 'object' &&
        typeof f.tableName === 'string' &&
        typeof f.columnName === 'string' &&
        typeof f.dtype === 'string' &&
        typeof f.label === 'string' &&
        f.filter != null &&
        typeof f.filter === 'object' &&
        typeof f.filter.operator === 'string' &&
        typeof f.filter.value === 'string',
    );
  } catch {
    return [];
  }
}

export function storeFilters(key: string, filters: ActiveColumnFilter[]): void {
  localStorage.setItem(key, JSON.stringify(filters));
}
