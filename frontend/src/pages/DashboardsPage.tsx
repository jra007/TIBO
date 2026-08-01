import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Dashboard, Group, SavedView } from '../api/types';

function DashboardRow({ dashboard, groups, onShared }: { dashboard: Dashboard; groups: Group[]; onShared: () => void }) {
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
    <tr>
      <td>
        <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link>
      </td>
      <td>{dashboard.viewIds.length}</td>
      <td>{dashboard.visibility === 'private' ? 'Privé' : `Partagé (${sharedGroupName})`}</td>
      <td>{new Date(dashboard.createdAt).toLocaleDateString('fr-FR')}</td>
      <td>
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
          {dashboard.visibility === 'shared' ? 'Changer le partage' : 'Partager'}
        </button>
        {dashboard.visibility === 'shared' && (
          <button type="button" onClick={handleUnshare} disabled={sharing}>
            Ne plus partager
          </button>
        )}
      </td>
    </tr>
  );
}

export function DashboardsPage() {
  const [myDashboards, setMyDashboards] = useState<Dashboard[]>([]);
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);
  const [teamGroupId, setTeamGroupId] = useState('');
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
    apiClient.get<Group[]>('/groups').then(setGroups);
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
    if (!teamGroupId) return;
    setTeamDashboards(await apiClient.get<Dashboard[]>(`/dashboards/team/${encodeURIComponent(teamGroupId)}`));
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
            <th scope="col">Créé le</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {myDashboards.map((dashboard) => (
            <DashboardRow key={dashboard.id} dashboard={dashboard} groups={groups} onShared={refresh} />
          ))}
        </tbody>
      </table>

      <h2>Espace d'équipe</h2>
      <label htmlFor="team-group-id">Groupe</label>
      <select id="team-group-id" value={teamGroupId} onChange={(e) => setTeamGroupId(e.target.value)}>
        <option value="">Choisir un groupe…</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={loadTeamWorkspace} disabled={!teamGroupId}>
        Afficher
      </button>

      {teamDashboards && (
        <table>
          <caption>Tableaux de bord partagés avec ce groupe</caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Nombre de vues</th>
              <th scope="col">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {teamDashboards.map((dashboard) => (
              <tr key={dashboard.id}>
                <td>
                  <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link>
                </td>
                <td>{dashboard.viewIds.length}</td>
                <td>{new Date(dashboard.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
