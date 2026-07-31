import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { DetectedRelation } from '../../api/types';
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

export function RelationsReviewPage() {
  const [relations, setRelations] = useState<DetectedRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section>
      <h2>Relations détectées</h2>
      <button type="button" onClick={detect} disabled={loading}>
        Relancer la détection
      </button>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <table>
        <caption>Relations détectées entre les tables importées</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Cible</th>
            <th scope="col">Score de confiance</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {relations.map((relation) => (
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
        </tbody>
      </table>
    </section>
  );
}
