import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, SavedView, ViewData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
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

function EditDashboardForm({
  dashboard,
  onSaved,
  onCancel,
}: {
  dashboard: Dashboard;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [name, setName] = useState(dashboard.name);
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>(dashboard.viewIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<SavedView[]>('/views/mine').then(setMyViews);
  }, []);

  function toggleView(viewId: string) {
    setSelectedViewIds((prev) => (prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/dashboards/${dashboard.id}`, { name, viewIds: selectedViewIds });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour du tableau de bord.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="calculated-field-form">
      <h3>Modifier le tableau de bord</h3>
      <label htmlFor="edit-dashboard-name">Nom</label>
      <input id="edit-dashboard-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <fieldset>
        <legend>Vues à inclure</legend>
        {myViews.map((view) => (
          <label key={view.id}>
            <input type="checkbox" checked={selectedViewIds.includes(view.id)} onChange={() => toggleView(view.id)} />
            {view.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="page-actions">
        <button type="submit" disabled={saving || !name}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
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
            <button type="button" onClick={() => setEditing(true)}>
              Modifier
            </button>
          )}
          <button type="button" className="secondary" onClick={() => handleExport('excel')} disabled={exporting || tiles.length === 0}>
            Exporter en Excel
          </button>
          <button type="button" className="secondary" onClick={() => handleExport('pdf')} disabled={exporting || tiles.length === 0}>
            Exporter en PDF
          </button>
        </div>
      </div>
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
              colorField={tile.view.shelves.color[0]}
              sizeField={tile.view.shelves.size[0]}
              rows={tile.rows}
              headerLabels={tile.headerLabels}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
