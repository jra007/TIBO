import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
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
        <h1>TIBO</h1>
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
