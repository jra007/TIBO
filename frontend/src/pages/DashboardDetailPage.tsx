import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, DashboardLayout, DashboardTileSize, Group, SavedView, ViewData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EditDashboardForm } from '../components/EditDashboardForm';
import { ExportMenu } from '../components/ExportMenu';
import { ShareControl } from '../components/ShareControl';
import { useDateSelection } from '../date-selection/DateSelectionContext';
import { CHART_TYPE_OPTIONS, loadStoredChartType, storeChartType } from './chart-presentation';
import type { ChartType } from './view-builder/suggestChartType';
import { ViewChart } from './view-builder/ViewChart';

interface DashboardTileData {
  view: SavedView;
  rows: Record<string, unknown>[];
  headerLabels: Record<string, string>;
}

function presentationStorageKey(dashboardId: string, viewId: string): string {
  return `tibo:dashboard-presentation:${dashboardId}:${viewId}`;
}

const TILE_SIZE_SPANS: Record<DashboardTileSize, number> = { small: 1, medium: 2, large: 3 };
const TILE_SIZE_LABELS: Record<DashboardTileSize, string> = { small: 'Petit', medium: 'Moyen', large: 'Grand' };

function tileSize(layout: DashboardLayout, viewId: string): DashboardTileSize {
  return layout[viewId]?.size ?? 'medium';
}

export function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { selectedDate } = useDateSelection();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tiles, setTiles] = useState<DashboardTileData[]>([]);
  const [presentations, setPresentations] = useState<Record<string, ChartType>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    apiClient.get<Group[]>('/groups').then(setGroups);
  }, []);

  async function handleShare(groupId: string) {
    if (!id) return;
    await apiClient.post(`/dashboards/${id}/share`, { groupId });
    setDashboard(await apiClient.get<Dashboard>(`/dashboards/${id}`));
  }

  async function handleUnshare() {
    if (!id) return;
    await apiClient.post(`/dashboards/${id}/unshare`);
    setDashboard(await apiClient.get<Dashboard>(`/dashboards/${id}`));
  }

  async function load() {
    if (!id || !selectedDate) return;
    try {
      const dashboardResult = await apiClient.get<Dashboard>(`/dashboards/${id}`);
      setDashboard(dashboardResult);
      const loaded = await Promise.all(
        dashboardResult.viewIds.map(async (viewId) => {
          const dataUrl = `/views/${viewId}/data?date=${encodeURIComponent(selectedDate)}`;
          const [view, data] = await Promise.all([apiClient.get<SavedView>(`/views/${viewId}`), apiClient.get<ViewData>(dataUrl)]);
          return {
            view,
            rows: data.rows,
            headerLabels: Object.fromEntries(data.headers.map((header, i) => [header, data.headerLabels[i]])),
          };
        }),
      );
      setTiles(loaded);
      setPresentations(
        Object.fromEntries(
          loaded.map((tile) => [tile.view.id, loadStoredChartType(presentationStorageKey(dashboardResult.id, tile.view.id)) ?? tile.view.chartType]),
        ),
      );
    } catch {
      setError('Impossible de charger ce tableau de bord.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedDate]);

  function handlePresentationChange(viewId: string, chartType: ChartType) {
    if (!id) return;
    storeChartType(presentationStorageKey(id, viewId), chartType);
    setPresentations((prev) => ({ ...prev, [viewId]: chartType }));
  }

  /** Persists an arrangement/size change and re-sorts the already-loaded tiles locally — the
   * underlying view data hasn't changed, only how it's arranged, so there's no need to refetch it. */
  async function persistLayout(newViewIds: string[], newLayout: DashboardLayout) {
    if (!dashboard) return;
    const updated = await apiClient.put<Dashboard>(`/dashboards/${dashboard.id}`, { name: dashboard.name, viewIds: newViewIds, layout: newLayout });
    setDashboard(updated);
    setTiles((prev) => {
      const byId = new Map(prev.map((tile) => [tile.view.id, tile]));
      return newViewIds.map((viewId) => byId.get(viewId)).filter((tile): tile is DashboardTileData => tile != null);
    });
  }

  function handleMoveTile(viewId: string, direction: -1 | 1) {
    if (!dashboard) return;
    const index = dashboard.viewIds.indexOf(viewId);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= dashboard.viewIds.length) return;
    const newViewIds = [...dashboard.viewIds];
    [newViewIds[index], newViewIds[swapWith]] = [newViewIds[swapWith], newViewIds[index]];
    void persistLayout(newViewIds, dashboard.layout);
  }

  function handleResizeTile(viewId: string, size: DashboardTileSize) {
    if (!dashboard) return;
    void persistLayout(dashboard.viewIds, { ...dashboard.layout, [viewId]: { size } });
  }

  async function handleExport(format: 'excel' | 'pdf') {
    if (!id || !dashboard) return;
    setExporting(true);
    setExportError(null);
    try {
      const dateSuffix = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : '';
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      await apiClient.download(`/exports/${format}/dashboard/${id}${dateSuffix}`, `${dashboard.name}.${extension}`);
    } catch {
      setExportError("Échec de l'export.");
    } finally {
      setExporting(false);
    }
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
        <div className="page-actions">
          {dashboard.ownerId === session?.user.id && !editing && (
            <>
              <button type="button" onClick={() => setEditing(true)}>
                Modifier
              </button>
              <button type="button" className="secondary" onClick={() => setSharing((v) => !v)}>
                {sharing ? 'Fermer' : dashboard.visibility === 'shared' ? 'Partagé' : 'Partager'}
              </button>
            </>
          )}
          <ExportMenu onExport={handleExport} disabled={exporting || tiles.length === 0} />
        </div>
      </div>
      {sharing && dashboard.ownerId === session?.user.id && (
        <ShareControl
          idPrefix={`dashboard-${dashboard.id}`}
          itemName={dashboard.name}
          visibility={dashboard.visibility}
          sharedWithGroupId={dashboard.sharedWithGroupId}
          groups={groups}
          onShare={handleShare}
          onUnshare={handleUnshare}
        />
      )}
      {exportError && (
        <p role="alert" className="error">
          {exportError}
        </p>
      )}

      {editing && (
        <EditDashboardForm
          dashboard={dashboard}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}

      {tiles.length === 0 && <p>Ce tableau de bord ne contient aucune vue.</p>}

      <div className="dashboard-grid">
        {tiles.map((tile, index) => {
          const size = tileSize(dashboard.layout, tile.view.id);
          const isOwner = dashboard.ownerId === session?.user.id;
          return (
            <div className="dashboard-tile" key={tile.view.id} style={{ gridColumn: `span ${TILE_SIZE_SPANS[size]}` }}>
              {isOwner && (
                <div className="dashboard-tile-controls">
                  <label htmlFor={`size-${tile.view.id}`} className="visually-hidden">
                    Taille de la tuile {tile.view.name}
                  </label>
                  <select id={`size-${tile.view.id}`} value={size} onChange={(e) => handleResizeTile(tile.view.id, e.target.value as DashboardTileSize)}>
                    {(Object.keys(TILE_SIZE_LABELS) as DashboardTileSize[]).map((option) => (
                      <option key={option} value={option}>
                        {TILE_SIZE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Déplacer ${tile.view.name} vers la gauche`}
                    onClick={() => handleMoveTile(tile.view.id, -1)}
                    disabled={index === 0}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Déplacer ${tile.view.name} vers la droite`}
                    onClick={() => handleMoveTile(tile.view.id, 1)}
                    disabled={index === tiles.length - 1}
                  >
                    ▶
                  </button>
                </div>
              )}
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
                colorField={tile.view.shelves.color[0]}
                sizeField={tile.view.shelves.size[0]}
                rows={tile.rows}
                headerLabels={tile.headerLabels}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
