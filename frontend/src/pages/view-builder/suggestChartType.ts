import type { ShelfAssignment } from './shelves';

export type ChartType = 'bar' | 'line' | 'scatter' | 'heatmap' | 'table' | 'geo';

/**
 * MVP heuristic covering the standard cases from the acceptance criteria:
 * 1 dimension + 1 measure, time series, and 2-dimension crosstab. A "dimension" is any field
 * without an aggregation (dates/text, or a numeric field explicitly used without one); a
 * "measure" is a numeric field with an aggregation set.
 */
export function suggestChartType(shelves: ShelfAssignment): ChartType {
  const fields = [...shelves.rows, ...shelves.columns];
  const hasDate = fields.some((f) => f.dtype === 'date');
  const dimensionCount = fields.filter((f) => !f.aggregation).length;

  if (hasDate) return 'line';
  if (dimensionCount >= 2) return 'heatmap';
  if (dimensionCount === 1) return 'bar';
  return 'table';
}
