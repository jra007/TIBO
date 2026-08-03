import { NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="admin-layout">
      <nav aria-label="Paramétrage">
        <NavLink to="/admin/ingestion">Ingestion</NavLink>
        <NavLink to="/admin/relations">Relations</NavLink>
        <NavLink to="/admin/retention">Rétention</NavLink>
        <NavLink to="/admin/groups">Groupes</NavLink>
        <NavLink to="/admin/projects">Projets</NavLink>
        <NavLink to="/admin/rbac">Permissions</NavLink>
        <NavLink to="/admin/auth">Authentification</NavLink>
        <NavLink to="/admin/smtp">SMTP</NavLink>
        <NavLink to="/admin/appearance">Apparence</NavLink>
        <NavLink to="/admin/reports">Rapport</NavLink>
        <NavLink to="/admin/reset">Réinitialisation</NavLink>
      </nav>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
