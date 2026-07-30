export function LoginPage() {
  return (
    <section>
      <h1>Connexion</h1>
      <form aria-label="Formulaire de connexion">
        <label htmlFor="username">Identifiant</label>
        <input id="username" name="username" type="text" autoComplete="username" />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" />
        <button type="submit">Se connecter</button>
      </form>
    </section>
  );
}
