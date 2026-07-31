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

export interface Field {
  id: string;
  tableName: string;
  columnName: string;
  dtype: ColumnType;
  /** Only meaningful when dtype === 'numeric' — set automatically (default "sum") once the field is placed on a shelf. */
  aggregation?: Aggregation;
}

export type ShelfAssignment = Record<ShelfId, Field[]>;

export const emptyShelfAssignment: ShelfAssignment = {
  rows: [],
  columns: [],
  color: [],
  size: [],
  filters: [],
};
