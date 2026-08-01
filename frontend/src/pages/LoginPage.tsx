import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, resolveApiUrl } from '../api/client';
import type { AuthMethodsStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAppearance } from '../theme/AppearanceContext';
import { DEFAULT_TITLE } from '../theme/apply-appearance';

export function LoginPage() {
  const { login, loginLdap } = useAuth();
  const { appearance } = useAppearance();
  const navigate = useNavigate();
  const [method, setMethod] = useState<'local' | 'ldap'>('local');
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get<AuthMethodsStatus>('/auth/methods').then((methods) => setLdapEnabled(methods.ldap));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (method === 'ldap') await loginLdap(username, password);
      else await login(username, password);
      navigate('/');
    } catch {
      setError('Identifiants invalides.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section>
        {appearance?.logoUrl && <img src={resolveApiUrl(appearance.logoUrl)} alt="" className="login-logo" />}
        <h1>{appearance?.title || DEFAULT_TITLE}</h1>

        {ldapEnabled && (
          <div className="page-actions" role="tablist" aria-label="Méthode de connexion">
            <button type="button" className={method === 'local' ? undefined : 'secondary'} onClick={() => setMethod('local')}>
              Local
            </button>
            <button type="button" className={method === 'ldap' ? undefined : 'secondary'} onClick={() => setMethod('ldap')}>
              LDAP
            </button>
          </div>
        )}

        <form aria-label="Formulaire de connexion" onSubmit={handleSubmit}>
          <label htmlFor="username">Identifiant</label>
          <input id="username" name="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </section>
    </div>
  );
}
