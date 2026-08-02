import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { Dashboard, SavedView } from '../api/types';

/** Rename a dashboard and change its included views — shared between the list page (inline, per card) and the dashboard's own detail page. */
export function EditDashboardForm({
  dashboard,
  onSaved,
  onCancel,
}: {
  dashboard: Dashboard;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [myViews, setMyViews] = useState<SavedView[]>([]);
  const [name, setName] = useState(dashboard.name);
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>(dashboard.viewIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<SavedView[]>('/views/mine').then(setMyViews);
  }, []);

  function toggleView(viewId: string) {
    setSelectedViewIds((prev) => (prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/dashboards/${dashboard.id}`, { name, viewIds: selectedViewIds });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour du tableau de bord.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="calculated-field-form">
      <h3>Modifier le tableau de bord</h3>
      <label htmlFor={`edit-dashboard-name-${dashboard.id}`}>Nom</label>
      <input id={`edit-dashboard-name-${dashboard.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
      <fieldset>
        <legend>Vues à inclure</legend>
        {myViews.map((view) => (
          <label key={view.id}>
            <input type="checkbox" checked={selectedViewIds.includes(view.id)} onChange={() => toggleView(view.id)} />
            {view.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="page-actions">
        <button type="submit" disabled={saving || !name}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
