import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { AdminUser } from '../../api/types';

export function AuthSettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setUsers(await apiClient.get<AdminUser[]>('/admin/settings/users'));
    } catch {
      setError('Impossible de charger les comptes locaux.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/admin/settings/users', { username, password });
    setUsername('');
    setPassword('');
    await refresh();
  }

  return (
    <section>
      <h2>Authentification</h2>
      <p>Bascule local/LDAP. Paramètres LDAP (serveur, base DN, mapping) éditables mais inactifs avant la phase 2.</p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

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
