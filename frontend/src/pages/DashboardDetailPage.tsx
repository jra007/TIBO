import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, SavedView, ViewData } from '../api/types';
import type { ChartType } from './view-builder/suggestChartType';
import { ViewChart } from './view-builder/ViewChart';

interface DashboardTileData {
  view: SavedView;
  rows: Record<string, unknown>[];
  headerLabels: Record<string, string>;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barres' },
  { value: 'line', label: 'Ligne' },
  { value: 'scatter', label: 'Nuage de points' },
  { value: 'heatmap', label: 'Carte de chaleur' },
  { value: 'table', label: 'Table' },
  { value: 'geo', label: 'Carte géographique' },
];

/** Per-viewer preference, not part of the dashboard's saved definition — each person can look at a shared dashboard differently. Kept in this browser only. */
function presentationStorageKey(dashboardId: string, viewId: string): string {
  return `tibo:dashboard-presentation:${dashboardId}:${viewId}`;
}

function loadStoredPresentation(dashboardId: string, viewId: string): ChartType | null {
  const stored = localStorage.getItem(presentationStorageKey(dashboardId, viewId));
  return CHART_TYPE_OPTIONS.some((option) => option.value === stored) ? (stored as ChartType) : null;
}

export function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tiles, setTiles] = useState<DashboardTileData[]>([]);
  const [presentations, setPresentations] = useState<Record<string, ChartType>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<Dashboard>(`/dashboards/${id}`)
      .then(async (dashboardResult) => {
        setDashboard(dashboardResult);
        const loaded = await Promise.all(
          dashboardResult.viewIds.map(async (viewId) => {
            const [view, data] = await Promise.all([apiClient.get<SavedView>(`/views/${viewId}`), apiClient.get<ViewData>(`/views/${viewId}/data`)]);
            return {
              view,
              rows: data.rows,
              headerLabels: Object.fromEntries(data.headers.map((header, i) => [header, data.headerLabels[i]])),
            };
          }),
        );
        setTiles(loaded);
        setPresentations(
          Object.fromEntries(loaded.map((tile) => [tile.view.id, loadStoredPresentation(dashboardResult.id, tile.view.id) ?? tile.view.chartType])),
        );
      })
      .catch(() => setError('Impossible de charger ce tableau de bord.'));
  }, [id]);

  function handlePresentationChange(viewId: string, chartType: ChartType) {
    if (!id) return;
    localStorage.setItem(presentationStorageKey(id, viewId), chartType);
    setPresentations((prev) => ({ ...prev, [viewId]: chartType }));
  }

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  }

  if (!dashboard) return <p>Chargement…</p>;

  return (
    <section>
      <Link to="/dashboards">← Tableaux de bord</Link>
      <div className="page-header">
        <h1>{dashboard.name}</h1>
      </div>

      {tiles.length === 0 && <p>Ce tableau de bord ne contient aucune vue.</p>}

      <div className="dashboard-grid">
        {tiles.map((tile) => (
          <div className="dashboard-tile" key={tile.view.id}>
            <div className="dashboard-tile-header">
              <h2>
                <Link to={`/views/${tile.view.id}`}>{tile.view.name}</Link>
              </h2>
              <label htmlFor={`presentation-${tile.view.id}`} className="visually-hidden">
                Mode de présentation pour {tile.view.name}
              </label>
              <select
                id={`presentation-${tile.view.id}`}
                value={presentations[tile.view.id] ?? tile.view.chartType}
                onChange={(e) => handlePresentationChange(tile.view.id, e.target.value as ChartType)}
              >
                {CHART_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <ViewChart
              chartType={presentations[tile.view.id] ?? tile.view.chartType}
              dimensionField={tile.view.shelves.rows[0]}
              measureField={tile.view.shelves.columns[0]}
              rows={tile.rows}
              headerLabels={tile.headerLabels}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
