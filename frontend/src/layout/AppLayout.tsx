import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { resolveApiUrl } from '../api/client';
import { useAuth, usePermission } from '../auth/AuthContext';
import { useAppearance } from '../theme/AppearanceContext';
import { DEFAULT_TITLE } from '../theme/apply-appearance';

export function AppLayout() {
  const canAccessSettings = usePermission('settings:access');
  const { session, logout } = useAuth();
  const { appearance } = useAppearance();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <nav aria-label="Navigation principale">
        <span className="app-brand">
          {appearance?.logoUrl && <img src={resolveApiUrl(appearance.logoUrl)} alt="" />}
          {appearance?.title || DEFAULT_TITLE}
        </span>
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
