import { Link } from 'react-router-dom';

export function ViewsPage() {
  return (
    <section>
      <h1>Mes vues</h1>
      <p>Vues privées et espaces d'équipe partagés apparaîtront ici.</p>
      <Link to="/views/new">Créer une vue</Link>
    </section>
  );
}
