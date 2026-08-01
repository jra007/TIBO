import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { SmtpSettings, SmtpTestResult, UpdateSmtpSettingsInput } from '../../api/types';

function toMsInput(value: number | null): string {
  return value === null ? '' : String(value);
}

function fromMsInput(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function SmtpSettingsPage() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [fromAddress, setFromAddress] = useState('');
  const [requireTLS, setRequireTLS] = useState(false);
  const [tlsRejectUnauthorized, setTlsRejectUnauthorized] = useState(true);
  const [connectTimeoutMs, setConnectTimeoutMs] = useState('');
  const [greetingTimeoutMs, setGreetingTimeoutMs] = useState('');
  const [socketTimeoutMs, setSocketTimeoutMs] = useState('');
  const [saving, setSaving] = useState(false);

  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);

  async function refresh() {
    const settings = await apiClient.get<SmtpSettings>('/admin/settings/smtp');
    setHost(settings.host);
    setPort(settings.port === null ? '' : String(settings.port));
    setSecure(settings.secure);
    setUsername(settings.username ?? '');
    setHasPassword(settings.hasPassword);
    setPassword('');
    setFromAddress(settings.fromAddress);
    setRequireTLS(settings.requireTLS);
    setTlsRejectUnauthorized(settings.tlsRejectUnauthorized);
    setConnectTimeoutMs(toMsInput(settings.connectTimeoutMs));
    setGreetingTimeoutMs(toMsInput(settings.greetingTimeoutMs));
    setSocketTimeoutMs(toMsInput(settings.socketTimeoutMs));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: UpdateSmtpSettingsInput = {
        host,
        port: port === '' ? null : Number(port),
        secure,
        username: username || null,
        fromAddress,
        requireTLS,
        tlsRejectUnauthorized,
        connectTimeoutMs: fromMsInput(connectTimeoutMs),
        greetingTimeoutMs: fromMsInput(greetingTimeoutMs),
        socketTimeoutMs: fromMsInput(socketTimeoutMs),
      };
      if (password !== '') body.password = password;
      await apiClient.put('/admin/settings/smtp', body);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(event: React.FormEvent) {
    event.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await apiClient.post<SmtpTestResult>('/admin/settings/smtp/test', { to: testTo }));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section>
      <h2>SMTP</h2>

      <form onSubmit={handleSave}>
        <h3>Configuration</h3>
        <label htmlFor="smtp-host">Hôte</label>
        <input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
        <label htmlFor="smtp-port">Port</label>
        <input id="smtp-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
        <label htmlFor="smtp-username">Nom d'utilisateur (optionnel)</label>
        <input id="smtp-username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label htmlFor="smtp-password">Mot de passe</label>
        <input
          id="smtp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={hasPassword ? 'Laisser vide pour ne pas changer' : ''}
          autoComplete="new-password"
        />
        <label htmlFor="smtp-from">Adresse d'expédition</label>
        <input id="smtp-from" type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="noreply@example.com" />

        <fieldset>
          <legend>Sécurité de la connexion</legend>
          <label>
            <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
            Connexion sécurisée (TLS direct — généralement port 465)
          </label>
          <label>
            <input type="checkbox" checked={requireTLS} onChange={(e) => setRequireTLS(e.target.checked)} />
            Forcer STARTTLS
          </label>
          <label>
            <input type="checkbox" checked={tlsRejectUnauthorized} onChange={(e) => setTlsRejectUnauthorized(e.target.checked)} />
            Rejeter les certificats TLS invalides
          </label>
        </fieldset>

        <fieldset>
          <legend>Délais d'attente (optionnel, en millisecondes)</legend>
          <label htmlFor="smtp-connect-timeout">Connexion</label>
          <input id="smtp-connect-timeout" type="number" value={connectTimeoutMs} onChange={(e) => setConnectTimeoutMs(e.target.value)} />
          <label htmlFor="smtp-greeting-timeout">Salutation SMTP</label>
          <input id="smtp-greeting-timeout" type="number" value={greetingTimeoutMs} onChange={(e) => setGreetingTimeoutMs(e.target.value)} />
          <label htmlFor="smtp-socket-timeout">Inactivité du socket</label>
          <input id="smtp-socket-timeout" type="number" value={socketTimeoutMs} onChange={(e) => setSocketTimeoutMs(e.target.value)} />
        </fieldset>

        <button type="submit" disabled={saving}>
          Enregistrer
        </button>
      </form>

      <form onSubmit={handleTest}>
        <h3>Tester la configuration</h3>
        <label htmlFor="smtp-test-to">Envoyer un email de test à</label>
        <input id="smtp-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} required />
        <button type="submit" disabled={testing || !testTo}>
          {testing ? 'Envoi…' : 'Envoyer un test'}
        </button>
        {testResult && (
          <output>
            <p className={testResult.success ? undefined : 'error'} role={testResult.success ? undefined : 'alert'}>
              {testResult.message}
            </p>
          </output>
        )}
      </form>
    </section>
  );
}
