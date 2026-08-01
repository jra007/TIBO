import type { ChartType } from './view-builder/suggestChartType';

export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barres' },
  { value: 'line', label: 'Ligne' },
  { value: 'scatter', label: 'Nuage de points' },
  { value: 'heatmap', label: 'Carte de chaleur' },
  { value: 'table', label: 'Table' },
  { value: 'geo', label: 'Carte géographique' },
];

/** Per-viewer display preference, not part of the saved view/dashboard definition — kept in this browser only. */
export function loadStoredChartType(key: string): ChartType | null {
  const stored = localStorage.getItem(key);
  return CHART_TYPE_OPTIONS.some((option) => option.value === stored) ? (stored as ChartType) : null;
}

export function storeChartType(key: string, chartType: ChartType): void {
  localStorage.setItem(key, chartType);
}
