import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Group, SavedView } from '../api/types';
import { StatusBadge, type StatusTone } from '../components/StatusBadge';

const RELATION_STATUS_LABELS: Record<SavedView['relationStatus'], string> = {
  validated: 'Relation validée',
  pending: 'Relation non validée',
  to_fix: 'À corriger',
};

const RELATION_STATUS_TONES: Record<SavedView['relationStatus'], StatusTone> = {
  validated: 'good',
  pending: 'warning',
  to_fix: 'critical',
};

function RelationStatusBadge({ status }: { status: SavedView['relationStatus'] }) {
  return <StatusBadge tone={RELATION_STATUS_TONES[status]}>{RELATION_STATUS_LABELS[status]}</StatusBadge>;
}

function ViewRow({ view, groups, onShared }: { view: SavedView; groups: Group[]; onShared: () => void }) {
  const [shareGroupId, setShareGroupId] = useState(view.sharedWithGroupId ?? '');
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sharedGroupName = groups.find((g) => g.id === view.sharedWithGroupId)?.name ?? view.sharedWithGroupId;

  async function handleShare() {
    if (!shareGroupId) return;
    setSharing(true);
    try {
      await apiClient.post(`/views/${view.id}/share`, { groupId: shareGroupId });
      onShared();
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare() {
    setSharing(true);
    try {
      await apiClient.post(`/views/${view.id}/unshare`);
      setShareGroupId('');
      onShared();
    } finally {
      setSharing(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    setError(null);
    try {
      await apiClient.download(`/exports/excel/${view.id}`, `${view.name}.xlsx`);
    } catch {
      setError("Échec de l'export.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    setError(null);
    try {
      await apiClient.download(`/exports/pdf/${view.id}`, `${view.name}.pdf`);
    } catch {
      setError("Échec de l'export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <tr>
      <td>
        <Link to={`/views/${view.id}`}>{view.name}</Link>
      </td>
      <td>{view.chartType}</td>
      <td>{view.visibility === 'private' ? 'Privée' : `Partagée (${sharedGroupName})`}</td>
      <td>
        <RelationStatusBadge status={view.relationStatus} />
      </td>
      <td>{new Date(view.createdAt).toLocaleDateString('fr-FR')}</td>
      <td>
        <Link to={`/views/${view.id}/edit`} className="button">
          Modifier
        </Link>
        <label htmlFor={`share-group-${view.id}`} className="visually-hidden">
          Partager {view.name} avec un groupe
        </label>
        <select id={`share-group-${view.id}`} value={shareGroupId} onChange={(e) => setShareGroupId(e.target.value)}>
          <option value="">Choisir un groupe…</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleShare} disabled={sharing || !shareGroupId || shareGroupId === view.sharedWithGroupId}>
          {view.visibility === 'shared' ? 'Changer le partage' : 'Partager'}
        </button>
        {view.visibility === 'shared' && (
          <button type="button" onClick={handleUnshare} disabled={sharing}>
            Ne plus partager
          </button>
        )}
        <button type="button" onClick={handleExportExcel} disabled={exporting}>
          Exporter en Excel
        </button>
        <button type="button" onClick={handleExportPdf} disabled={exporting}>
          Exporter en PDF
        </button>
        {error && (
          <span role="alert" className="error">
            {error}
          </span>
        )}
      </td>
    </tr>
  );
}

export function ViewsPage() {
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teamGroupId, setTeamGroupId] = useState('');
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
    apiClient.get<Group[]>('/groups').then(setGroups);
  }, []);

  async function loadTeamWorkspace() {
    if (!teamGroupId) return;
    setTeamViews(await apiClient.get<SavedView[]>(`/views/team/${encodeURIComponent(teamGroupId)}`));
  }

  return (
    <section>
      <div className="page-header">
        <h1>Mes vues</h1>
        <Link to="/views/new" className="button">
          + Créer une vue
        </Link>
      </div>

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
            <th scope="col">Créée le</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {myViews.map((view) => (
            <ViewRow key={view.id} view={view} groups={groups} onShared={refreshMine} />
          ))}
        </tbody>
      </table>

      <h2>Espace d'équipe</h2>
      <p>Ce que les autres membres d'un groupe voient dans leur espace partagé — utile pour vérifier ce qu'un groupe peut consulter.</p>
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

      {teamViews && (
        <table>
          <caption>Vues partagées avec ce groupe</caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Type</th>
              <th scope="col">Statut</th>
              <th scope="col">Créée le</th>
            </tr>
          </thead>
          <tbody>
            {teamViews.map((view) => (
              <tr key={view.id}>
                <td>
                  <Link to={`/views/${view.id}`}>{view.name}</Link>
                </td>
                <td>{view.chartType}</td>
                <td>
                  <RelationStatusBadge status={view.relationStatus} />
                </td>
                <td>{new Date(view.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
