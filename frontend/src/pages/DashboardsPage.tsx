import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, DashboardTileSize, Group, SavedView, ViewData } from '../api/types';
import { AddKpiForm } from '../components/AddKpiForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditDashboardForm } from '../components/EditDashboardForm';
import { useDateSelection } from '../date-selection/DateSelectionContext';
import { TILE_SIZE_LABELS, tileSize } from './dashboard-tile-size';

interface DashboardKpi {
  id: string;
  label: string;
  value: number;
  size: DashboardTileSize;
}

/**
 * The whole point of a KPI is seeing it at a glance — surfacing it only after opening a
 * dashboard defeated that. Fetches just the dashboard's 'number'-typed views (skips the rest,
 * no need to load full chart data for a card) and shows each as a compact value + label, sized
 * to match the Petit/Moyen/Grand already chosen for that tile on the dashboard's own page.
 * `onChanged` present (only for "my" dashboards, not read-only shared ones) also makes the size
 * editable right here — writes through the same PUT /dashboards/:id the dashboard's own page
 * uses, so both stay in sync regardless of which one was used to change it.
 */
function DashboardKpiPreview({ dashboard, onChanged }: { dashboard: Dashboard; onChanged?: () => Promise<void> }) {
  const { selectedDate } = useDateSelection();
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const { viewIds, layout } = dashboard;

  useEffect(() => {
    if (!selectedDate || viewIds.length === 0) {
      setKpis([]);
      return;
    }
    let cancelled = false;
    async function load() {
      const results = await Promise.all(
        viewIds.map(async (viewId): Promise<DashboardKpi | null> => {
          try {
            const view = await apiClient.get<SavedView>(`/views/${viewId}`);
            if (view.chartType !== 'number') return null;
            const data = await apiClient.get<ViewData>(`/views/${viewId}/data?date=${encodeURIComponent(selectedDate as string)}`);
            const measureKey = data.headers[0];
            const value = data.rows.length > 0 && measureKey ? Number(data.rows[0][measureKey]) || 0 : 0;
            return { id: viewId, label: view.name, value, size: tileSize(layout, viewId) };
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) setKpis(results.filter((r): r is DashboardKpi => r != null));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [viewIds, layout, selectedDate]);

  async function handleResize(viewId: string, size: DashboardTileSize) {
    if (!onChanged) return;
    await apiClient.put(`/dashboards/${dashboard.id}`, {
      name: dashboard.name,
      viewIds: dashboard.viewIds,
      layout: { ...dashboard.layout, [viewId]: { size } },
    });
    await onChanged();
  }

  if (kpis.length === 0) return null;

  return (
    <div className="dashboard-list-card-kpis">
      {kpis.map((kpi) => (
        <div className={`dashboard-list-card-kpi dashboard-list-card-kpi-${kpi.size}`} key={kpi.id}>
          <div className="dashboard-list-card-kpi-value">{new Intl.NumberFormat('fr-FR').format(kpi.value)}</div>
          <div className="dashboard-list-card-kpi-label">{kpi.label}</div>
          {onChanged && (
            <>
              <label htmlFor={`kpi-size-${kpi.id}`} className="visually-hidden">
                Taille de {kpi.label}
              </label>
              <select id={`kpi-size-${kpi.id}`} value={kpi.size} onChange={(e) => handleResize(kpi.id, e.target.value as DashboardTileSize)}>
                {(Object.keys(TILE_SIZE_LABELS) as DashboardTileSize[]).map((option) => (
                  <option key={option} value={option}>
                    {TILE_SIZE_LABELS[option]}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardCard({ dashboard, onChanged }: { dashboard: Dashboard; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setConfirmingDelete(false);
    setDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/dashboards/${dashboard.id}`);
      await onChanged();
    } catch {
      setError('Échec de la suppression.');
      setDeleting(false);
    }
  }

  return (
    <div className="dashboard-list-card">
      <div className="dashboard-list-card-header">
        <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link>
        <span className={`visibility-pill ${dashboard.visibility}`}>{dashboard.visibility === 'private' ? 'Privé' : 'Partagé'}</span>
      </div>
      <p className="dashboard-list-card-meta">
        {dashboard.viewIds.length} vue{dashboard.viewIds.length > 1 ? 's' : ''} · Créé le {new Date(dashboard.createdAt).toLocaleDateString('fr-FR')}
      </p>
      <DashboardKpiPreview dashboard={dashboard} onChanged={onChanged} />

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {editing ? (
        <EditDashboardForm
          dashboard={dashboard}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      ) : (
        <div className="page-actions">
          <button type="button" className="secondary" onClick={() => setEditing(true)}>
            Modifier
          </button>
          <button type="button" className="danger" onClick={() => setConfirmingDelete(true)} disabled={deleting}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer ce tableau de bord"
        message={`Supprimer « ${dashboard.name} » ? Les vues qu'il contient ne sont pas supprimées, uniquement ce tableau de bord.`}
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

function TeamDashboardCard({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="dashboard-list-card">
      <div className="dashboard-list-card-header">
        <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link>
      </div>
      <p className="dashboard-list-card-meta">
        {dashboard.viewIds.length} vue{dashboard.viewIds.length > 1 ? 's' : ''} · Créé le {new Date(dashboard.createdAt).toLocaleDateString('fr-FR')}
      </p>
      <DashboardKpiPreview dashboard={dashboard} />
    </div>
  );
}

export function DashboardsPage() {
  const [myDashboards, setMyDashboards] = useState<Dashboard[]>([]);
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [teamDashboards, setTeamDashboards] = useState<Dashboard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);
  const [addingKpi, setAddingKpi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [dashboardsResult, viewsResult] = await Promise.all([
        apiClient.get<Dashboard[]>('/dashboards/mine'),
        apiClient.get<SavedView[]>('/views/mine'),
      ]);
      setMyDashboards(dashboardsResult);
      setMyViews(viewsResult);
    } catch {
      setError('Impossible de charger les tableaux de bord.');
    }
  }

  async function loadTeamDashboards() {
    const myGroups = await apiClient.get<Group[]>('/groups/mine');
    const perGroup = await Promise.all(myGroups.map((group) => apiClient.get<Dashboard[]>(`/dashboards/team/${group.id}`)));
    const deduped = new Map<string, Dashboard>();
    for (const list of perGroup) for (const dashboard of list) deduped.set(dashboard.id, dashboard);
    setTeamDashboards([...deduped.values()]);
  }

  useEffect(() => {
    refresh();
    loadTeamDashboards();
  }, []);

  function toggleView(viewId: string) {
    setSelectedViewIds((prev) => (prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]));
  }

  /** The dashboard doesn't exist yet at this point — the new KPI view just joins the same
   * "views to include" selection as any already-existing view, checked by default. */
  async function handleKpiCreatedBeforeSave(view: SavedView) {
    setMyViews((prev) => [...prev, view]);
    setSelectedViewIds((prev) => [...prev, view.id]);
    setAddingKpi(false);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/dashboards', { name, viewIds: selectedViewIds, layout: {} });
    setName('');
    setSelectedViewIds([]);
    setShowCreateForm(false);
    await refresh();
  }

  const myDashboardIds = new Set(myDashboards.map((d) => d.id));
  const sharedWithMyTeam = teamDashboards.filter((d) => !myDashboardIds.has(d.id));

  return (
    <section>
      <div className="page-header">
        <h1>Tableaux de bord</h1>
        <button type="button" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? 'Annuler' : '+ Nouveau tableau de bord'}
        </button>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {showCreateForm && (
        <>
          <form onSubmit={handleCreate} className="calculated-field-form">
            <h3>Créer un tableau de bord</h3>
            <label htmlFor="dashboard-name">Nom</label>
            <input id="dashboard-name" value={name} onChange={(e) => setName(e.target.value)} required />
            <fieldset>
              <legend>Vues à inclure</legend>
              {myViews.map((view) => (
                <label key={view.id}>
                  <input type="checkbox" checked={selectedViewIds.includes(view.id)} onChange={() => toggleView(view.id)} />
                  {view.name}
                </label>
              ))}
            </fieldset>
            <div className="page-actions">
              <button type="button" className="secondary" onClick={() => setAddingKpi((v) => !v)}>
                {addingKpi ? 'Fermer' : '+ Ajouter un indicateur'}
              </button>
              <button type="submit" disabled={!name || selectedViewIds.length === 0}>
                Créer
              </button>
            </div>
          </form>
          {/* Rendered as a sibling, not nested inside the form above — a <form> inside another <form> is invalid HTML and browsers silently mis-handle it (e.g. the inner submit can trigger the outer one). */}
          {addingKpi && <AddKpiForm onCreated={handleKpiCreatedBeforeSave} onCancel={() => setAddingKpi(false)} />}
        </>
      )}

      <h2>Mes tableaux de bord</h2>
      {myDashboards.length === 0 ? (
        <p>Aucun tableau de bord pour le moment.</p>
      ) : (
        <div className="dashboard-list-grid">
          {myDashboards.map((dashboard) => (
            <DashboardCard key={dashboard.id} dashboard={dashboard} onChanged={refresh} />
          ))}
        </div>
      )}

      {sharedWithMyTeam.length > 0 && (
        <>
          <h2>Partagés avec mon équipe</h2>
          <div className="dashboard-list-grid">
            {sharedWithMyTeam.map((dashboard) => (
              <TeamDashboardCard key={dashboard.id} dashboard={dashboard} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
