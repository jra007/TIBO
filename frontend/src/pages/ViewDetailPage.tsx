import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { SavedView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge, type StatusTone } from '../components/StatusBadge';
import { ViewChart } from './view-builder/ViewChart';

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

export function ViewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [view, setView] = useState<SavedView | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([apiClient.get<SavedView>(`/views/${id}`), apiClient.get<{ headers: string[]; rows: Record<string, unknown>[] }>(`/views/${id}/data`)])
      .then(([viewResult, dataResult]) => {
        setView(viewResult);
        setRows(dataResult.rows);
      })
      .catch(() => setError('Impossible de charger cette vue.'));
  }, [id]);

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  }

  if (!view) return <p>Chargement…</p>;

  return (
    <section>
      <Link to="/views">← Mes vues</Link>
      <div className="page-header">
        <h1>{view.name}</h1>
        {view.ownerId === session?.user.id && (
          <Link to={`/views/${view.id}/edit`} className="button">
            Modifier
          </Link>
        )}
      </div>
      {view.relationStatus !== 'validated' && (
        <output style={{ display: 'block', marginBottom: 12 }}>
          <StatusBadge tone={RELATION_STATUS_TONES[view.relationStatus]}>{RELATION_STATUS_LABELS[view.relationStatus]}</StatusBadge>
        </output>
      )}
      <ViewChart chartType={view.chartType} dimensionField={view.shelves.rows[0]} measureField={view.shelves.columns[0]} rows={rows} />
    </section>
  );
}
