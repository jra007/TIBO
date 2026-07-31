import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { SmtpSettings } from '../../api/types';

export function SmtpSettingsPage() {
  const [serverUrl, setServerUrl] = useState('');
  const [port, setPort] = useState(587);
  const [credentialsSecretRef, setCredentialsSecretRef] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const settings = await apiClient.get<SmtpSettings>('/admin/settings/smtp');
    setServerUrl(settings.serverUrl);
    setPort(settings.port);
    setCredentialsSecretRef(settings.credentialsSecretRef);
    setSenderAddress(settings.senderAddress);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiClient.put('/admin/settings/smtp', { serverUrl, port, credentialsSecretRef, senderAddress });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>SMTP</h2>
      <p>Écran présent dès le MVP, sans effet tant que la phase 2 n'active pas l'envoi d'emails.</p>

      <form onSubmit={handleSave}>
        <label htmlFor="smtp-server">Serveur</label>
        <input id="smtp-server" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="smtp.example.com" />
        <label htmlFor="smtp-port">Port</label>
        <input id="smtp-port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        <label htmlFor="smtp-credentials-ref">Référence des identifiants (coffre-fort de secrets)</label>
        <input id="smtp-credentials-ref" value={credentialsSecretRef} onChange={(e) => setCredentialsSecretRef(e.target.value)} placeholder="vault://smtp/credentials" />
        <label htmlFor="smtp-sender">Adresse expéditeur</label>
        <input id="smtp-sender" type="email" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="noreply@example.com" />
        <button type="submit" disabled={saving}>
          Enregistrer
        </button>
      </form>
    </section>
  );
}
