import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { ReportSettings, UpdateReportSettingsInput } from '../../api/types';

export function ReportSettingsPage() {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerSubtitle, setHeaderSubtitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const result = await apiClient.get<ReportSettings>('/admin/settings/reports');
    setSettings(result);
    setHeaderTitle(result.headerTitle ?? '');
    setHeaderSubtitle(result.headerSubtitle ?? '');
  }

  useEffect(() => {
    load().catch(() => setError('Impossible de charger les paramètres de rapport.'));
  }, []);

  async function handleSaveText(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.put('/admin/settings/reports', {
        headerTitle: headerTitle || null,
        headerSubtitle: headerSubtitle || null,
      } satisfies UpdateReportSettingsInput);
      await load();
    } catch {
      setError('Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(field: 'showLogo' | 'showPageNumbers' | 'showExportDate', value: boolean) {
    setError(null);
    try {
      await apiClient.put('/admin/settings/reports', { [field]: value } satisfies UpdateReportSettingsInput);
      await load();
    } catch {
      setError('Échec de la sauvegarde.');
    }
  }

  if (!settings) return null;

  return (
    <section>
      <h2>Rapport</h2>
      <p>Personnalise l'en-tête et le pied de page appliqués à chaque export PDF d'une vue ou d'un tableau de bord.</p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleSaveText}>
        <label htmlFor="report-header-title">Titre de l'en-tête</label>
        <input id="report-header-title" value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} placeholder="Reprend le titre de l'application si laissé vide" />

        <label htmlFor="report-header-subtitle">Sous-titre (optionnel)</label>
        <input
          id="report-header-subtitle"
          value={headerSubtitle}
          onChange={(e) => setHeaderSubtitle(e.target.value)}
          placeholder="ex. Rapport confidentiel — usage interne"
        />

        <div className="page-actions">
          <button type="submit" disabled={saving}>
            Enregistrer
          </button>
        </div>
      </form>

      <fieldset>
        <legend>Contenu du pied de page</legend>
        <label>
          <input type="checkbox" checked={settings.showLogo} onChange={(e) => handleToggle('showLogo', e.target.checked)} />
          Afficher le logo dans l'en-tête
        </label>
        <label>
          <input type="checkbox" checked={settings.showPageNumbers} onChange={(e) => handleToggle('showPageNumbers', e.target.checked)} />
          Afficher la numérotation des pages
        </label>
        <label>
          <input type="checkbox" checked={settings.showExportDate} onChange={(e) => handleToggle('showExportDate', e.target.checked)} />
          Afficher la date d'export
        </label>
      </fieldset>
    </section>
  );
}
