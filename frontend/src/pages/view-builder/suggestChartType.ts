import type { ShelfAssignment } from './shelves';

export type ChartType = 'bar' | 'line' | 'scatter' | 'heatmap' | 'table' | 'geo';

/**
 * MVP heuristic covering the standard cases from the acceptance criteria:
 * 1 dimension + 1 measure, time series, and 2-dimension crosstab.
 * Column type inference (date/numeric/etc.) will refine this once wired to real metadata.
 */
export function suggestChartType(shelves: ShelfAssignment): ChartType {
  const dimensionCount = shelves.rows.length + shelves.columns.length;
  const hasDate = [...shelves.rows, ...shelves.columns].some((f) => f.columnName.toLowerCase().includes('date'));

  if (hasDate) return 'line';
  if (dimensionCount >= 2) return 'heatmap';
  if (dimensionCount === 1) return 'bar';
  return 'table';
}
