import { useRef, useState } from 'react';
import { apiClient, resolveApiUrl } from '../../api/client';
import type { UpdateAppearanceSettingsInput, UploadedFileMeta } from '../../api/types';
import { useAppearance } from '../../theme/AppearanceContext';

const DEFAULT_PRIMARY_COLOR = '#2a78d6';
const DEFAULT_BACKGROUND_COLOR = '#f9f9f7';

function LogoOrFaviconCard({
  label,
  description,
  url,
  field,
  onSaved,
}: {
  label: string;
  description: string;
  url: string | null;
  field: 'logoFileId' | 'faviconFileId';
  onSaved: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await apiClient.postForm<UploadedFileMeta>('/uploads', formData);
      await apiClient.put('/appearance', { [field]: uploaded.id } satisfies UpdateAppearanceSettingsInput);
      await onSaved();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    await apiClient.put('/appearance', { [field]: null } satisfies UpdateAppearanceSettingsInput);
    await onSaved();
  }

  return (
    <div className="appearance-card">
      <h3>{label}</h3>
      <p>{description}</p>
      <div className="appearance-preview">
        {url ? <img src={resolveApiUrl(url)} alt={label} /> : <span className="appearance-preview-empty">Aucun</span>}
      </div>
      <label className="button" htmlFor={`${field}-input`}>
        {uploading ? 'Envoi…' : url ? 'Changer' : 'Choisir un fichier'}
      </label>
      <input ref={inputRef} id={`${field}-input`} type="file" accept="image/*" onChange={handlePick} disabled={uploading} className="visually-hidden" />
      {url && (
        <button type="button" className="secondary" onClick={handleRemove} disabled={uploading}>
          Retirer
        </button>
      )}
    </div>
  );
}

function ColorCard({
  label,
  description,
  value,
  defaultValue,
  field,
  onSaved,
}: {
  label: string;
  description: string;
  value: string | null;
  defaultValue: string;
  field: 'primaryColor' | 'backgroundColor';
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? defaultValue);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put('/appearance', { [field]: draft } satisfies UpdateAppearanceSettingsInput);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await apiClient.put('/appearance', { [field]: null } satisfies UpdateAppearanceSettingsInput);
      setDraft(defaultValue);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="appearance-card">
      <h3>{label}</h3>
      <p>{description}</p>
      <label htmlFor={`${field}-input`} className="visually-hidden">
        {label}
      </label>
      <input id={`${field}-input`} type="color" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <span>{draft}</span>
      <div className="page-actions">
        <button type="button" onClick={handleSave} disabled={saving}>
          Enregistrer
        </button>
        {value != null && (
          <button type="button" className="secondary" onClick={handleReset} disabled={saving}>
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}

export function AppearanceSettingsPage() {
  const { appearance, refresh } = useAppearance();
  const [title, setTitle] = useState(appearance?.title ?? '');
  const [savingTitle, setSavingTitle] = useState(false);

  async function handleSaveTitle(event: React.FormEvent) {
    event.preventDefault();
    setSavingTitle(true);
    try {
      await apiClient.put('/appearance', { title: title || null } satisfies UpdateAppearanceSettingsInput);
      await refresh();
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleResetTitle() {
    setSavingTitle(true);
    try {
      await apiClient.put('/appearance', { title: null } satisfies UpdateAppearanceSettingsInput);
      setTitle('');
      await refresh();
    } finally {
      setSavingTitle(false);
    }
  }

  if (!appearance) return null;

  return (
    <section>
      <h2>Apparence</h2>
      <p>Personnalise le logo, le titre, la couleur des boutons et la couleur de fond de l'application. Les changements s'appliquent immédiatement.</p>

      <div className="appearance-grid">
        <LogoOrFaviconCard label="Logo" description="Affiché dans la barre de navigation." url={appearance.logoUrl} field="logoFileId" onSaved={refresh} />

        <div className="appearance-card">
          <h3>Titre et favicon</h3>
          <p>Le titre s'affiche dans l'onglet du navigateur et dans la barre de navigation.</p>
          <form onSubmit={handleSaveTitle}>
            <label htmlFor="appearance-title">Titre</label>
            <input id="appearance-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="TIBO" />
            <div className="page-actions">
              <button type="submit" disabled={savingTitle}>
                Enregistrer
              </button>
              {appearance.title && (
                <button type="button" className="secondary" onClick={handleResetTitle} disabled={savingTitle}>
                  Réinitialiser
                </button>
              )}
            </div>
          </form>
          <LogoOrFaviconCard
            label="Favicon"
            description="Icône affichée dans l'onglet du navigateur."
            url={appearance.faviconUrl}
            field="faviconFileId"
            onSaved={refresh}
          />
        </div>

        <ColorCard
          label="Couleur des boutons"
          description="Couleur d'accentuation utilisée pour les boutons et liens."
          value={appearance.primaryColor}
          defaultValue={DEFAULT_PRIMARY_COLOR}
          field="primaryColor"
          onSaved={refresh}
        />
        <ColorCard
          label="Couleur de fond"
          description="Couleur de fond des pages."
          value={appearance.backgroundColor}
          defaultValue={DEFAULT_BACKGROUND_COLOR}
          field="backgroundColor"
          onSaved={refresh}
        />
      </div>
    </section>
  );
}
