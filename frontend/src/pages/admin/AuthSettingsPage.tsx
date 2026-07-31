import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { AdminUser, AuthSettings } from '../../api/types';

export function AuthSettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [activeMode, setActiveMode] = useState<AuthSettings['activeMode']>('local');
  const [ldapServerUrl, setLdapServerUrl] = useState('');
  const [ldapBaseDn, setLdapBaseDn] = useState('');
  const [ldapAttributeMappingJson, setLdapAttributeMappingJson] = useState('{}');
  const [ldapError, setLdapError] = useState<string | null>(null);
  const [savingLdap, setSavingLdap] = useState(false);

  async function refresh() {
    try {
      setUsers(await apiClient.get<AdminUser[]>('/admin/settings/users'));
    } catch {
      setError('Impossible de charger les comptes locaux.');
    }
  }

  async function refreshAuthSettings() {
    const settings = await apiClient.get<AuthSettings>('/admin/settings/auth');
    setActiveMode(settings.activeMode);
    setLdapServerUrl(settings.ldap.serverUrl);
    setLdapBaseDn(settings.ldap.baseDn);
    setLdapAttributeMappingJson(JSON.stringify(settings.ldap.attributeMapping, null, 2));
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
    setLdapError(null);
    let attributeMapping: Record<string, string>;
    try {
      attributeMapping = JSON.parse(ldapAttributeMappingJson);
    } catch {
      setLdapError('Le mapping des attributs doit être un JSON valide.');
      return;
    }
    setSavingLdap(true);
    try {
      await apiClient.put('/admin/settings/auth', {
        activeMode,
        ldap: { serverUrl: ldapServerUrl, baseDn: ldapBaseDn, attributeMapping },
      });
      await refreshAuthSettings();
    } finally {
      setSavingLdap(false);
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
        <h3>Mode d'authentification</h3>
        <p>
          Le mode LDAP peut être configuré et enregistré dès maintenant, mais reste sans effet tant que la phase 2 n'est pas
          livrée — les comptes locaux restent actifs quel que soit ce réglage.
        </p>
        <label htmlFor="active-mode">Mode actif</label>
        <select id="active-mode" value={activeMode} onChange={(e) => setActiveMode(e.target.value as AuthSettings['activeMode'])}>
          <option value="local">Local</option>
          <option value="ldap">LDAP</option>
        </select>
        <label htmlFor="ldap-server">Serveur LDAP</label>
        <input id="ldap-server" value={ldapServerUrl} onChange={(e) => setLdapServerUrl(e.target.value)} placeholder="ldap://..." />
        <label htmlFor="ldap-base-dn">Base DN</label>
        <input id="ldap-base-dn" value={ldapBaseDn} onChange={(e) => setLdapBaseDn(e.target.value)} placeholder="dc=example,dc=com" />
        <label htmlFor="ldap-mapping">Mapping des attributs (JSON)</label>
        <textarea id="ldap-mapping" value={ldapAttributeMappingJson} onChange={(e) => setLdapAttributeMappingJson(e.target.value)} rows={5} />
        {ldapError && (
          <p role="alert" className="error">
            {ldapError}
          </p>
        )}
        <button type="submit" disabled={savingLdap}>
          Enregistrer
        </button>
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
