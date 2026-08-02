import type { DashboardLayout, DashboardTileSize } from '../api/types';

export const TILE_SIZE_SPANS: Record<DashboardTileSize, number> = { small: 1, medium: 2, large: 3 };
export const TILE_SIZE_LABELS: Record<DashboardTileSize, string> = { small: 'Petit', medium: 'Moyen', large: 'Grand' };

/** A tile with no entry in the layout (any dashboard, or any view added before this feature) falls back to 'medium'. */
export function tileSize(layout: DashboardLayout, viewId: string): DashboardTileSize {
  return layout[viewId]?.size ?? 'medium';
}
