import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, Group, SavedView } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditDashboardForm } from '../components/EditDashboardForm';

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
            <button type="submit" disabled={!name || selectedViewIds.length === 0}>
              Créer
            </button>
          </div>
        </form>
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
