import { useState } from 'react';
import { apiClient } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface ResetSummary {
  droppedTables: string[];
  clearedRowCounts: Record<string, number>;
}

const CONFIRMATION_PHRASE = 'SUPPRIMER TOUT';

export function DataResetPage() {
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const canReset = confirmation === CONFIRMATION_PHRASE;

  async function handleReset() {
    setShowConfirmDialog(false);
    setResetting(true);
    setError(null);
    setSummary(null);
    try {
      const result = await apiClient.post<ResetSummary>('/admin/settings/reset', { confirmation });
      setSummary(result);
      setConfirmation('');
    } catch {
      setError('Échec de la réinitialisation.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <section>
      <h2>Réinitialisation complète</h2>
      <p>
        Supprime définitivement toutes les données métier importées : fichiers ingérés, relations détectées, vues,
        tableaux de bord, libellés de colonnes et notifications.
      </p>
      <p>
        Les utilisateurs, groupes, rôles, permissions, paramètres (rétention, authentification, SMTP) et le journal
        d'audit sont conservés.
      </p>

      <div className="danger-zone">
        <label htmlFor="reset-confirmation">
          Pour confirmer, tapez exactement <strong>{CONFIRMATION_PHRASE}</strong>
        </label>
        <input
          id="reset-confirmation"
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
        <button type="button" className="danger" disabled={!canReset || resetting} onClick={() => setShowConfirmDialog(true)}>
          {resetting ? 'Réinitialisation en cours…' : 'Tout réinitialiser'}
        </button>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Dernière confirmation"
        message="Toutes les données importées, relations, vues et tableaux de bord seront définitivement supprimés. Cette action est irréversible."
        confirmLabel="Tout réinitialiser"
        tone="danger"
        onConfirm={handleReset}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {summary && (
        <output>
          <p>Réinitialisation terminée.</p>
          <p>Tables supprimées : {summary.droppedTables.length > 0 ? summary.droppedTables.join(', ') : 'aucune'}</p>
          <ul>
            {Object.entries(summary.clearedRowCounts).map(([table, count]) => (
              <li key={table}>
                {table} : {count} ligne(s) supprimée(s)
              </li>
            ))}
          </ul>
        </output>
      )}
    </section>
  );
}
