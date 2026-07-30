import { NavLink, Outlet } from 'react-router-dom';
import { usePermission } from '../auth/PermissionsContext';

export function AppLayout() {
  const canAccessSettings = usePermission('settings:access');

  return (
    <div className="app-layout">
      <nav aria-label="Navigation principale">
        <NavLink to="/views">Mes vues</NavLink>
        <NavLink to="/dashboards">Tableaux de bord</NavLink>
        {canAccessSettings && <NavLink to="/admin">Paramétrage</NavLink>}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
