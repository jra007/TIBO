import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, SavedView, ViewData } from '../api/types';
import { ViewChart } from './view-builder/ViewChart';

interface DashboardTileData {
  view: SavedView;
  rows: Record<string, unknown>[];
  headerLabels: Record<string, string>;
}

export function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tiles, setTiles] = useState<DashboardTileData[]>([]);
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
      })
      .catch(() => setError('Impossible de charger ce tableau de bord.'));
  }, [id]);

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
            <h2>
              <Link to={`/views/${tile.view.id}`}>{tile.view.name}</Link>
            </h2>
            <ViewChart
              chartType={tile.view.chartType}
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
