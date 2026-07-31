import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { Dashboard, SavedView } from '../api/types';

function DashboardRow({ dashboard, onShared }: { dashboard: Dashboard; onShared: () => void }) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    const groupId = window.prompt('Partager avec quel groupe ?');
    if (!groupId) return;
    setSharing(true);
    try {
      await apiClient.post(`/dashboards/${dashboard.id}/share`, { groupId });
      onShared();
    } finally {
      setSharing(false);
    }
  }

  return (
    <tr>
      <td>{dashboard.name}</td>
      <td>{dashboard.viewIds.length}</td>
      <td>{dashboard.visibility === 'private' ? 'Privé' : `Partagé (${dashboard.sharedWithGroupId})`}</td>
      <td>
        {dashboard.visibility === 'private' && (
          <button type="button" onClick={handleShare} disabled={sharing}>
            Partager
          </button>
        )}
      </td>
    </tr>
  );
}

export function DashboardsPage() {
  const [myDashboards, setMyDashboards] = useState<Dashboard[]>([]);
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);
  const [groupId, setGroupId] = useState('');
  const [teamDashboards, setTeamDashboards] = useState<Dashboard[] | null>(null);
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

  useEffect(() => {
    refresh();
  }, []);

  function toggleView(viewId: string) {
    setSelectedViewIds((prev) => (prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/dashboards', { name, viewIds: selectedViewIds, layout: {} });
    setName('');
    setSelectedViewIds([]);
    await refresh();
  }

  async function loadTeamWorkspace() {
    if (!groupId) return;
    setTeamDashboards(await apiClient.get<Dashboard[]>(`/dashboards/team/${encodeURIComponent(groupId)}`));
  }

  return (
    <section>
      <h1>Tableaux de bord</h1>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate}>
        <h2>Créer un tableau de bord</h2>
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
        <button type="submit" disabled={!name || selectedViewIds.length === 0}>
          Créer
        </button>
      </form>

      <table>
        <caption>Mes tableaux de bord</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Nombre de vues</th>
            <th scope="col">Visibilité</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {myDashboards.map((dashboard) => (
            <DashboardRow key={dashboard.id} dashboard={dashboard} onShared={refresh} />
          ))}
        </tbody>
      </table>

      <h2>Espace d'équipe</h2>
      <label htmlFor="team-group-id">Identifiant du groupe</label>
      <input id="team-group-id" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
      <button type="button" onClick={loadTeamWorkspace}>
        Afficher
      </button>

      {teamDashboards && (
        <table>
          <caption>Tableaux de bord partagés avec ce groupe</caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Nombre de vues</th>
            </tr>
          </thead>
          <tbody>
            {teamDashboards.map((dashboard) => (
              <tr key={dashboard.id}>
                <td>{dashboard.name}</td>
                <td>{dashboard.viewIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
