import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { SavedView } from '../api/types';
import { ViewChart } from './view-builder/ViewChart';

const RELATION_STATUS_LABELS: Record<SavedView['relationStatus'], string> = {
  validated: 'Relation validée',
  pending: 'Relation non validée',
  to_fix: 'À corriger',
};

export function ViewDetailPage() {
  const { id } = useParams<{ id: string }>();
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
      <h1>{view.name}</h1>
      {view.relationStatus !== 'validated' && <output>{RELATION_STATUS_LABELS[view.relationStatus]}</output>}
      <ViewChart chartType={view.chartType} dimensionField={view.shelves.rows[0]} measureField={view.shelves.columns[0]} rows={rows} />
    </section>
  );
}
