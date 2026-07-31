import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { SavedView } from '../api/types';

const RELATION_STATUS_LABELS: Record<SavedView['relationStatus'], string> = {
  validated: 'Relation validée',
  pending: 'Relation non validée',
  to_fix: 'À corriger',
};

function ViewRow({ view, onShared }: { view: SavedView; onShared: () => void }) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    const groupId = window.prompt('Partager avec quel groupe ?');
    if (!groupId) return;
    setSharing(true);
    try {
      await apiClient.post(`/views/${view.id}/share`, { groupId });
      onShared();
    } finally {
      setSharing(false);
    }
  }

  return (
    <tr>
      <td>{view.name}</td>
      <td>{view.chartType}</td>
      <td>{view.visibility === 'private' ? 'Privée' : `Partagée (${view.sharedWithGroupId})`}</td>
      <td>{RELATION_STATUS_LABELS[view.relationStatus]}</td>
      <td>
        {view.visibility === 'private' && (
          <button type="button" onClick={handleShare} disabled={sharing}>
            Partager
          </button>
        )}
      </td>
    </tr>
  );
}

export function ViewsPage() {
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [groupId, setGroupId] = useState('');
  const [teamViews, setTeamViews] = useState<SavedView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshMine() {
    try {
      setMyViews(await apiClient.get<SavedView[]>('/views/mine'));
    } catch {
      setError('Impossible de charger vos vues.');
    }
  }

  useEffect(() => {
    refreshMine();
  }, []);

  async function loadTeamWorkspace() {
    if (!groupId) return;
    setTeamViews(await apiClient.get<SavedView[]>(`/views/team/${encodeURIComponent(groupId)}`));
  }

  return (
    <section>
      <h1>Mes vues</h1>
      <Link to="/views/new">Créer une vue</Link>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <table>
        <caption>Vues privées</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Type</th>
            <th scope="col">Visibilité</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {myViews.map((view) => (
            <ViewRow key={view.id} view={view} onShared={refreshMine} />
          ))}
        </tbody>
      </table>

      <h2>Espace d'équipe</h2>
      <label htmlFor="team-group-id">Identifiant du groupe</label>
      <input id="team-group-id" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
      <button type="button" onClick={loadTeamWorkspace}>
        Afficher
      </button>

      {teamViews && (
        <table>
          <caption>Vues partagées avec ce groupe</caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Type</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            {teamViews.map((view) => (
              <tr key={view.id}>
                <td>{view.name}</td>
                <td>{view.chartType}</td>
                <td>{RELATION_STATUS_LABELS[view.relationStatus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
