import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function AccountPage() {
  const { session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Mot de passe actuel incorrect.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Mon compte</h1>
      <p>Connecté en tant que {session?.user.displayName}.</p>

      <form onSubmit={handleSubmit}>
        <h2>Changer le mot de passe</h2>
        <label htmlFor="current-password">Mot de passe actuel</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <label htmlFor="new-password">Nouveau mot de passe</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {success && <output>Mot de passe mis à jour.</output>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Changer le mot de passe'}
        </button>
      </form>
    </section>
  );
}
