import { useRef, useState } from 'react';
import { apiClient, resolveApiUrl } from '../../api/client';
import type { UpdateAppearanceSettingsInput, UploadedFileMeta } from '../../api/types';
import { SettingsRow } from '../../components/SettingsRow';
import { useAppearance } from '../../theme/AppearanceContext';

const DEFAULT_PRIMARY_COLOR = '#2a78d6';
const DEFAULT_BACKGROUND_COLOR = '#f9f9f7';

function ImageField({ url, field, onSaved }: { url: string | null; field: 'logoFileId' | 'faviconFileId'; onSaved: () => Promise<void> }) {
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
    <>
      <div className="settings-image-preview">
        {url ? <img src={resolveApiUrl(url)} alt="" /> : <span className="settings-image-preview-empty">Aucun</span>}
      </div>
      <label className="secondary button" htmlFor={`${field}-input`}>
        {uploading ? 'Envoi…' : url ? 'Changer' : 'Choisir un fichier'}
      </label>
      <input ref={inputRef} id={`${field}-input`} type="file" accept="image/*" onChange={handlePick} disabled={uploading} className="visually-hidden" />
      {url && (
        <button type="button" className="secondary" onClick={handleRemove} disabled={uploading}>
          Retirer
        </button>
      )}
    </>
  );
}

function ColorField({
  value,
  defaultValue,
  field,
  onSaved,
}: {
  value: string | null;
  defaultValue: string;
  field: 'primaryColor' | 'backgroundColor';
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? defaultValue);
  const [saving, setSaving] = useState(false);
  const dirty = draft !== (value ?? defaultValue);

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
    <>
      <label htmlFor={`${field}-input`} className="visually-hidden">
        Couleur
      </label>
      <input id={`${field}-input`} type="color" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <span className="settings-color-value">{draft}</span>
      {dirty && (
        <button type="button" onClick={handleSave} disabled={saving}>
          Enregistrer
        </button>
      )}
      {value != null && !dirty && (
        <button type="button" className="secondary" onClick={handleReset} disabled={saving}>
          Réinitialiser
        </button>
      )}
    </>
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
      <p>Personnalise le logo, le titre et les couleurs de l'application. Les changements s'appliquent immédiatement.</p>

      <div className="settings-list">
        <SettingsRow title="Titre" description="Affiché dans la barre de navigation et l'onglet du navigateur.">
          <form onSubmit={handleSaveTitle} className="settings-inline-form">
            <label htmlFor="appearance-title" className="visually-hidden">
              Titre
            </label>
            <input id="appearance-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="TIBO" />
            {title !== (appearance.title ?? '') && (
              <button type="submit" disabled={savingTitle}>
                Enregistrer
              </button>
            )}
            {appearance.title && title === appearance.title && (
              <button type="button" className="secondary" onClick={handleResetTitle} disabled={savingTitle}>
                Réinitialiser
              </button>
            )}
          </form>
        </SettingsRow>

        <SettingsRow title="Logo" description="Affiché dans la barre de navigation, à côté du titre.">
          <ImageField url={appearance.logoUrl} field="logoFileId" onSaved={refresh} />
        </SettingsRow>

        <SettingsRow title="Favicon" description="Icône affichée dans l'onglet du navigateur.">
          <ImageField url={appearance.faviconUrl} field="faviconFileId" onSaved={refresh} />
        </SettingsRow>

        <SettingsRow title="Couleur des boutons" description="Couleur d'accentuation utilisée pour les boutons et liens.">
          <ColorField value={appearance.primaryColor} defaultValue={DEFAULT_PRIMARY_COLOR} field="primaryColor" onSaved={refresh} />
        </SettingsRow>

        <SettingsRow title="Couleur de fond" description="Couleur de fond des pages.">
          <ColorField value={appearance.backgroundColor} defaultValue={DEFAULT_BACKGROUND_COLOR} field="backgroundColor" onSaved={refresh} />
        </SettingsRow>
      </div>
    </section>
  );
}
