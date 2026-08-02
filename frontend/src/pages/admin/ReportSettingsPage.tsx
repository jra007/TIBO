import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { ReportSettings, UpdateReportSettingsInput } from '../../api/types';
import { SettingsRow } from '../../components/SettingsRow';

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

  const textDirty = headerTitle !== (settings.headerTitle ?? '') || headerSubtitle !== (settings.headerSubtitle ?? '');

  return (
    <section>
      <h2>Rapport</h2>
      <p>Personnalise l'en-tête et le pied de page appliqués à chaque export PDF d'une vue ou d'un tableau de bord.</p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="settings-list">
        <SettingsRow title="Titre de l'en-tête" description="Reprend le titre de l'application si laissé vide.">
          <form onSubmit={handleSaveText} className="settings-inline-form">
            <label htmlFor="report-header-title" className="visually-hidden">
              Titre de l'en-tête
            </label>
            <input id="report-header-title" value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} placeholder="TIBO" />
            {textDirty && (
              <button type="submit" disabled={saving}>
                Enregistrer
              </button>
            )}
          </form>
        </SettingsRow>

        <SettingsRow title="Sous-titre" description="Optionnel — ex. « Rapport confidentiel, usage interne ».">
          <form onSubmit={handleSaveText} className="settings-inline-form">
            <label htmlFor="report-header-subtitle" className="visually-hidden">
              Sous-titre
            </label>
            <input id="report-header-subtitle" value={headerSubtitle} onChange={(e) => setHeaderSubtitle(e.target.value)} placeholder="Aucun" />
            {textDirty && (
              <button type="submit" disabled={saving}>
                Enregistrer
              </button>
            )}
          </form>
        </SettingsRow>

        <SettingsRow title="Logo" description="Afficher le logo de l'application dans l'en-tête du rapport.">
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.showLogo} onChange={(e) => handleToggle('showLogo', e.target.checked)} />
            <span className="visually-hidden">Afficher le logo</span>
          </label>
        </SettingsRow>

        <SettingsRow title="Numérotation des pages" description="Afficher « Page X / Y » dans le pied de page.">
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.showPageNumbers} onChange={(e) => handleToggle('showPageNumbers', e.target.checked)} />
            <span className="visually-hidden">Afficher la numérotation des pages</span>
          </label>
        </SettingsRow>

        <SettingsRow title="Date d'export" description="Afficher la date de génération dans le pied de page.">
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.showExportDate} onChange={(e) => handleToggle('showExportDate', e.target.checked)} />
            <span className="visually-hidden">Afficher la date d'export</span>
          </label>
        </SettingsRow>
      </div>
    </section>
  );
}
