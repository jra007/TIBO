import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'tibo.selectedProject';

interface ProjectSelectionContextValue {
  /** The active project id, or null for "tous les projets" (no scoping). */
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
}

const ProjectSelectionContext = createContext<ProjectSelectionContextValue | undefined>(undefined);

/**
 * The view builder's active project — narrows the field picker to that project's own tables plus
 * any shared table (see backend ColumnProfilerService.listSourceTables). Same localStorage-backed
 * pattern as DateSelectionContext, but with no analogous "most recently used" default to fetch: an
 * unset project means "tous les projets" (unscoped, the same as before projects existed), not an
 * ambiguous state that needs resolving on mount.
 */
export function ProjectSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  function setSelectedProjectId(projectId: string | null) {
    if (projectId) localStorage.setItem(STORAGE_KEY, projectId);
    else localStorage.removeItem(STORAGE_KEY);
    setSelectedProjectIdState(projectId);
  }

  return (
    <ProjectSelectionContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>{children}</ProjectSelectionContext.Provider>
  );
}

export function useProjectSelection(): ProjectSelectionContextValue {
  const ctx = useContext(ProjectSelectionContext);
  if (!ctx) throw new Error('useProjectSelection must be used within ProjectSelectionProvider');
  return ctx;
}
