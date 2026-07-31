import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { RetentionPolicy, RetentionStatus, RetentionUnit } from '../../api/types';

const UNITS: RetentionUnit[] = ['hours', 'days', 'months', 'years'];
const STATUSES: RetentionStatus[] = ['active', 'legal_hold'];

function PolicyRow({ policy, onSaved }: { policy: RetentionPolicy; onSaved: () => void }) {
  const [duration, setDuration] = useState(policy.duration);
  const [unit, setUnit] = useState<RetentionUnit>(policy.unit);
  const [status, setStatus] = useState<RetentionStatus>(policy.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put(`/admin/settings/retention/${policy.dataType}`, { duration, unit, status });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{policy.dataType}</td>
      <td>
        <label htmlFor={`duration-${policy.dataType}`}>Durée</label>
        <input
          id={`duration-${policy.dataType}`}
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </td>
      <td>
        <label htmlFor={`unit-${policy.dataType}`}>Unité</label>
        <select id={`unit-${policy.dataType}`} value={unit} onChange={(e) => setUnit(e.target.value as RetentionUnit)}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td>
        <label htmlFor={`status-${policy.dataType}`}>Statut</label>
        <select id={`status-${policy.dataType}`} value={status} onChange={(e) => setStatus(e.target.value as RetentionStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'active' ? 'Actif' : 'Sous gel (legal hold)'}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button type="button" onClick={handleSave} disabled={saving}>
          Enregistrer
        </button>
      </td>
    </tr>
  );
}

export function RetentionSettingsPage() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setPolicies(await apiClient.get<RetentionPolicy[]>('/admin/settings/retention'));
    } catch {
      setError('Impossible de charger la politique de rétention.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section>
      <h2>Politique de rétention</h2>
      <p>Durées éditables par type de donnée. Chaque modification est journalisée avec l'ancienne et la nouvelle valeur.</p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <table>
        <caption>Durées de rétention</caption>
        <thead>
          <tr>
            <th scope="col">Type de donnée</th>
            <th scope="col">Durée</th>
            <th scope="col">Unité</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <PolicyRow key={policy.dataType} policy={policy} onSaved={refresh} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
