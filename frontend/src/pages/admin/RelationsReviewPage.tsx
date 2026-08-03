import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/client';
import type { DetectedRelation } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';

const STATUS_LABELS: Record<DetectedRelation['status'], string> = {
  proposed: 'Proposée',
  validated: 'Validée',
  rejected: 'Rejetée',
};

const STATUS_TONES: Record<DetectedRelation['status'], StatusTone> = {
  proposed: 'warning',
  validated: 'good',
  rejected: 'critical',
};

const STATUS_FILTER_STORAGE_KEY = 'tibo.relationsReview.hiddenStatuses';

/** Which statuses to hide, persisted per browser — an admin working through hundreds of proposed
 * relations doesn't want validated ones (already dealt with) cluttering the table on every visit. */
function loadHiddenStatuses(): Set<DetectedRelation['status']> {
  try {
    const raw = localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore malformed/inaccessible storage, fall through to the default
  }
  return new Set(['validated']);
}

export function RelationsReviewPage() {
  const [relations, setRelations] = useState<DetectedRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'proposed' | 'all' | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<DetectedRelation['status']>>(loadHiddenStatuses);

  function toggleStatusHidden(status: DetectedRelation['status']) {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      localStorage.setItem(STATUS_FILTER_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const visibleRelations = useMemo(() => relations.filter((r) => !hiddenStatuses.has(r.status)), [relations, hiddenStatuses]);
  const hiddenCount = relations.length - visibleRelations.length;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRelations(await apiClient.get<DetectedRelation[]>('/relations'));
    } catch {
      setError('Impossible de charger les relations. Vérifiez que le backend est démarré.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function detect() {
    setLoading(true);
    setError(null);
    try {
      setRelations(await apiClient.post<DetectedRelation[]>('/relations/detect'));
    } catch {
      setError('Échec de la détection.');
    } finally {
      setLoading(false);
    }
  }

  async function act(relation: DetectedRelation, action: 'validate' | 'reject') {
    await apiClient.post(`/relations/${relation.id}/${action}`);
    await refresh();
  }

  async function confirmDeleteProposed() {
    setConfirmAction(null);
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete('/relations/proposed');
      await refresh();
    } catch {
      setError('Échec de la suppression des propositions.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteAll() {
    setConfirmAction(null);
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete('/relations/all');
      await refresh();
    } catch {
      setError('Échec de la suppression complète.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Relations détectées</h2>
      <div className="page-actions">
        <button type="button" onClick={detect} disabled={loading}>
          Relancer la détection
        </button>
        <button type="button" onClick={() => setConfirmAction('proposed')} disabled={loading}>
          Supprimer les propositions
        </button>
        <button type="button" className="danger" onClick={() => setConfirmAction('all')} disabled={loading}>
          Tout supprimer
        </button>
      </div>

      <ConfirmDialog
        open={confirmAction === 'proposed'}
        title="Supprimer les propositions"
        message="Supprimer toutes les relations encore proposées (non validées, non rejetées) ? Elles pourront être régénérées en relançant la détection."
        confirmLabel="Supprimer les propositions"
        tone="danger"
        onConfirm={confirmDeleteProposed}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'all'}
        title="Tout supprimer"
        message="Supprimer TOUTES les relations, y compris celles déjà validées ou rejetées ? Cette action est irréversible."
        confirmLabel="Tout supprimer"
        tone="danger"
        onConfirm={confirmDeleteAll}
        onCancel={() => setConfirmAction(null)}
      />

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <fieldset className="filter-bar">
        <legend>Filtrer par statut</legend>
        {(Object.keys(STATUS_LABELS) as DetectedRelation['status'][]).map((status) => (
          <label key={status}>
            <input type="checkbox" checked={!hiddenStatuses.has(status)} onChange={() => toggleStatusHidden(status)} />
            {STATUS_LABELS[status]}
          </label>
        ))}
        {hiddenCount > 0 && <span>({hiddenCount} masquée(s))</span>}
      </fieldset>

      <table>
        <caption>Relations détectées entre les tables importées</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Cible</th>
            <th scope="col">Score de confiance</th>
            <th scope="col">Statut</th>
            <th scope="col">Détecté le</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleRelations.map((relation) => (
            <tr key={relation.id}>
              <td>
                {relation.sourceTable}.{relation.sourceColumn}
              </td>
              <td>
                {relation.targetTable}.{relation.targetColumn}
              </td>
              <td>{Math.round(relation.confidenceScore * 100)}%</td>
              <td>
                <StatusBadge tone={STATUS_TONES[relation.status]}>{STATUS_LABELS[relation.status]}</StatusBadge>
              </td>
              <td>{new Date(relation.createdAt).toLocaleString('fr-FR')}</td>
              <td>
                <button type="button" disabled={relation.status !== 'proposed'} onClick={() => act(relation, 'validate')}>
                  Valider
                </button>
                <button type="button" disabled={relation.status !== 'proposed'} onClick={() => act(relation, 'reject')}>
                  Rejeter
                </button>
              </td>
            </tr>
          ))}
          {visibleRelations.length === 0 && relations.length > 0 && (
            <tr>
              <td colSpan={6}>Toutes les relations sont masquées par le filtre de statut ci-dessus.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
