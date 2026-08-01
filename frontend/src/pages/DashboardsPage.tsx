import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, Group, SavedView } from '../api/types';

function DashboardCard({ dashboard, groups, onShared }: { dashboard: Dashboard; groups: Group[]; onShared: () => void }) {
  const [shareGroupId, setShareGroupId] = useState(dashboard.sharedWithGroupId ?? '');
  const [sharing, setSharing] = useState(false);

  const sharedGroupName = groups.find((g) => g.id === dashboard.sharedWithGroupId)?.name ?? dashboard.sharedWithGroupId;

  async function handleShare() {
    if (!shareGroupId) return;
    setSharing(true);
    try {
      await apiClient.post(`/dashboards/${dashboard.id}/share`, { groupId: shareGroupId });
      onShared();
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare() {
    setSharing(true);
    try {
      await apiClient.post(`/dashboards/${dashboard.id}/unshare`);
      setShareGroupId('');
      onShared();
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="dashboard-list-card">
      <div className="dashboard-list-card-header">
        <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link>
        <span className={`visibility-pill ${dashboard.visibility}`}>{dashboard.visibility === 'private' ? 'Privé' : `Partagé · ${sharedGroupName}`}</span>
      </div>
      <p className="dashboard-list-card-meta">
        {dashboard.viewIds.length} vue{dashboard.viewIds.length > 1 ? 's' : ''} · Créé le {new Date(dashboard.createdAt).toLocaleDateString('fr-FR')}
      </p>
      <div className="page-actions">
        <label htmlFor={`share-group-${dashboard.id}`} className="visually-hidden">
          Partager {dashboard.name} avec un groupe
        </label>
        <select id={`share-group-${dashboard.id}`} value={shareGroupId} onChange={(e) => setShareGroupId(e.target.value)}>
          <option value="">Choisir un groupe…</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleShare} disabled={sharing || !shareGroupId || shareGroupId === dashboard.sharedWithGroupId}>
          {dashboard.visibility === 'shared' ? 'Changer' : 'Partager'}
        </button>
        {dashboard.visibility === 'shared' && (
          <button type="button" className="secondary" onClick={handleUnshare} disabled={sharing}>
            Ne plus partager
          </button>
        )}
      </div>
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
        {dashboard.viewIds.length} vue{dashboard.viewIds.length > 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function DashboardsPage() {
  const [myDashboards, setMyDashboards] = useState<Dashboard[]>([]);
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
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
    apiClient.get<Group[]>('/groups').then(setGroups);
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
            <DashboardCard key={dashboard.id} dashboard={dashboard} groups={groups} onShared={refresh} />
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
