import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { apiClient, resolveApiUrl } from '../api/client';
import type { Project } from '../api/types';
import { useAuth, usePermission } from '../auth/AuthContext';
import { DateSelectionProvider, useDateSelection } from '../date-selection/DateSelectionContext';
import { ProjectSelectionProvider, useProjectSelection } from '../project-selection/ProjectSelectionContext';
import { useAppearance } from '../theme/AppearanceContext';
import { DEFAULT_TITLE } from '../theme/apply-appearance';

function GlobalDateSelector() {
  const { selectedDate, setSelectedDate } = useDateSelection();
  return (
    <label className="global-date-selector">
      <span className="visually-hidden">Date affichée</span>
      Données au
      <input type="date" value={selectedDate ?? ''} onChange={(e) => e.target.value && setSelectedDate(e.target.value)} />
    </label>
  );
}

function GlobalProjectSelector() {
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    apiClient
      .get<Project[]>('/projects')
      .then(setProjects)
      .catch(() => {
        // No projects created yet, or the request failed — the field picker just stays unscoped.
      });
  }, []);

  if (projects.length === 0) return null;

  return (
    <label className="global-project-selector">
      <span className="visually-hidden">Projet actif</span>
      Projet
      <select value={selectedProjectId ?? ''} onChange={(e) => setSelectedProjectId(e.target.value || null)}>
        <option value="">Tous les projets</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}

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
    <DateSelectionProvider>
      <ProjectSelectionProvider>
        <div className="app-layout">
          <nav aria-label="Navigation principale">
            <span className="app-brand">
              {appearance?.logoUrl && <img src={resolveApiUrl(appearance.logoUrl)} alt="" />}
              {appearance?.title || DEFAULT_TITLE}
            </span>
            <NavLink to="/views">Mes vues</NavLink>
            <NavLink to="/dashboards">Tableaux de bord</NavLink>
            {canAccessSettings && <NavLink to="/admin">Paramétrage</NavLink>}
            <GlobalProjectSelector />
            <GlobalDateSelector />
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
      </ProjectSelectionProvider>
    </DateSelectionProvider>
  );
}
