export type ShelfId = 'rows' | 'columns' | 'color' | 'size' | 'filters';

export const SHELVES: { id: ShelfId; label: string }[] = [
  { id: 'rows', label: 'Lignes' },
  { id: 'columns', label: 'Colonnes' },
  { id: 'color', label: 'Couleur' },
  { id: 'size', label: 'Taille' },
  { id: 'filters', label: 'Filtres' },
];

export interface Field {
  id: string;
  tableName: string;
  columnName: string;
}

export type ShelfAssignment = Record<ShelfId, Field[]>;

export const emptyShelfAssignment: ShelfAssignment = {
  rows: [],
  columns: [],
  color: [],
  size: [],
  filters: [],
};
