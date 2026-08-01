import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { AdminUser, AuthSettings, LdapTestResult, UpdateAuthSettingsInput } from '../../api/types';

function toMsInput(value: number | null): string {
  return value === null ? '' : String(value);
}

function fromMsInput(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function AuthSettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [bindDn, setBindDn] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const [hasBindPassword, setHasBindPassword] = useState(false);
  const [baseDn, setBaseDn] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [usernameAttribute, setUsernameAttribute] = useState('uid');
  const [tlsRejectUnauthorized, setTlsRejectUnauthorized] = useState(true);
  const [connectTimeoutMs, setConnectTimeoutMs] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('');
  const [savingLdap, setSavingLdap] = useState(false);

  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LdapTestResult | null>(null);

  async function refresh() {
    try {
      setUsers(await apiClient.get<AdminUser[]>('/admin/settings/users'));
    } catch {
      setError('Impossible de charger les comptes locaux.');
    }
  }

  async function refreshAuthSettings() {
    const settings = await apiClient.get<AuthSettings>('/admin/settings/auth');
    setEnabled(settings.ldap.enabled);
    setUrl(settings.ldap.url);
    setBindDn(settings.ldap.bindDn);
    setHasBindPassword(settings.ldap.hasBindPassword);
    setBindPassword('');
    setBaseDn(settings.ldap.baseDn);
    setSearchFilter(settings.ldap.searchFilter);
    setUsernameAttribute(settings.ldap.usernameAttribute);
    setTlsRejectUnauthorized(settings.ldap.tlsRejectUnauthorized);
    setConnectTimeoutMs(toMsInput(settings.ldap.connectTimeoutMs));
    setTimeoutMs(toMsInput(settings.ldap.timeoutMs));
  }

  useEffect(() => {
    refresh();
    refreshAuthSettings();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/admin/settings/users', { username, password });
    setUsername('');
    setPassword('');
    await refresh();
  }

  async function handleSaveLdap(event: React.FormEvent) {
    event.preventDefault();
    setSavingLdap(true);
    try {
      const body: UpdateAuthSettingsInput = {
        ldap: {
          enabled,
          url,
          bindDn,
          baseDn,
          searchFilter,
          usernameAttribute,
          tlsRejectUnauthorized,
          connectTimeoutMs: fromMsInput(connectTimeoutMs),
          timeoutMs: fromMsInput(timeoutMs),
        },
      };
      if (bindPassword !== '') body.ldap.bindPassword = bindPassword;
      await apiClient.put('/admin/settings/auth', body);
      await refreshAuthSettings();
    } finally {
      setSavingLdap(false);
    }
  }

  async function handleTest(event: React.FormEvent) {
    event.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(
        await apiClient.post<LdapTestResult>('/admin/settings/auth/ldap/test', {
          testUsername: testUsername || undefined,
          testPassword: testPassword || undefined,
        }),
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <section>
      <h2>Authentification</h2>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleSaveLdap}>
        <h3>LDAP</h3>
        <p>La connexion locale (identifiant + mot de passe) reste toujours disponible. LDAP est une option supplémentaire, activable indépendamment.</p>
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Activer la connexion LDAP
        </label>
        <label htmlFor="ldap-url">URL du serveur</label>
        <input id="ldap-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ldaps://ldap.exemple.com:636" />
        <label htmlFor="ldap-bind-dn">Bind DN (compte de service)</label>
        <input id="ldap-bind-dn" value={bindDn} onChange={(e) => setBindDn(e.target.value)} placeholder="cn=service,dc=exemple,dc=com" />
        <label htmlFor="ldap-bind-password">Mot de passe du compte de service</label>
        <input
          id="ldap-bind-password"
          type="password"
          value={bindPassword}
          onChange={(e) => setBindPassword(e.target.value)}
          placeholder={hasBindPassword ? 'Laisser vide pour ne pas changer' : ''}
          autoComplete="new-password"
        />
        <label htmlFor="ldap-base-dn">Base DN</label>
        <input id="ldap-base-dn" value={baseDn} onChange={(e) => setBaseDn(e.target.value)} placeholder="dc=exemple,dc=com" />
        <label htmlFor="ldap-search-filter">Filtre de recherche</label>
        <input id="ldap-search-filter" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="(uid={{username}})" />
        <label htmlFor="ldap-username-attribute">Attribut identifiant</label>
        <input id="ldap-username-attribute" value={usernameAttribute} onChange={(e) => setUsernameAttribute(e.target.value)} placeholder="uid" />
        <label>
          <input type="checkbox" checked={tlsRejectUnauthorized} onChange={(e) => setTlsRejectUnauthorized(e.target.checked)} />
          Vérifier le certificat TLS
        </label>

        <fieldset>
          <legend>Délais d'attente (optionnel, en millisecondes)</legend>
          <label htmlFor="ldap-connect-timeout">Connexion</label>
          <input id="ldap-connect-timeout" type="number" value={connectTimeoutMs} onChange={(e) => setConnectTimeoutMs(e.target.value)} />
          <label htmlFor="ldap-timeout">Opération</label>
          <input id="ldap-timeout" type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} />
        </fieldset>

        <button type="submit" disabled={savingLdap}>
          Enregistrer
        </button>
      </form>

      <form onSubmit={handleTest}>
        <h3>Tester la connexion</h3>
        <label htmlFor="ldap-test-username">Identifiant de test (optionnel)</label>
        <input id="ldap-test-username" value={testUsername} onChange={(e) => setTestUsername(e.target.value)} />
        <label htmlFor="ldap-test-password">Mot de passe de test (optionnel)</label>
        <input id="ldap-test-password" type="password" value={testPassword} onChange={(e) => setTestPassword(e.target.value)} />
        <button type="submit" disabled={testing}>
          {testing ? 'Test en cours…' : 'Tester la connexion'}
        </button>
        {testResult && (
          <output>
            <p className={testResult.success ? undefined : 'error'} role={testResult.success ? undefined : 'alert'}>
              {testResult.message}
            </p>
          </output>
        )}
      </form>

      <form onSubmit={handleCreate}>
        <h3>Créer un compte local</h3>
        <label htmlFor="new-username">Identifiant</label>
        <input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label htmlFor="new-password">Mot de passe</label>
        <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Créer</button>
      </form>

      <table>
        <caption>Comptes locaux</caption>
        <thead>
          <tr>
            <th scope="col">Identifiant</th>
            <th scope="col">Statut</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
