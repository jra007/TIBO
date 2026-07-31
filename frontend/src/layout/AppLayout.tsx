import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, usePermission } from '../auth/AuthContext';

export function AppLayout() {
  const canAccessSettings = usePermission('settings:access');
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <nav aria-label="Navigation principale">
        <NavLink to="/views">Mes vues</NavLink>
        <NavLink to="/dashboards">Tableaux de bord</NavLink>
        {canAccessSettings && <NavLink to="/admin">Paramétrage</NavLink>}
        <NavLink to="/account" className="account-link">
          {session?.user.displayName}
        </NavLink>
        <button type="button" onClick={handleLogout}>
          Se déconnecter
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
