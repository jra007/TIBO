import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { Project } from '../../api/types';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setProjects(await apiClient.get<Project[]>('/admin/settings/projects'));
    } catch {
      setError('Impossible de charger les projets.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/admin/settings/projects', { name, description });
    setName('');
    setDescription('');
    await refresh();
  }

  return (
    <section>
      <h2>Projets</h2>
      <p>
        Un fichier importé peut être rattaché à un projet précis, ou marqué « commun » pour rester visible dans tous les projets. Le constructeur de vues
        ne propose alors que les champs du projet actif (plus les fichiers communs).
      </p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate}>
        <h3>Créer un projet</h3>
        <label htmlFor="project-name">Nom</label>
        <input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="project-description">Description</label>
        <input id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit">Créer le projet</button>
      </form>

      <table>
        <caption>Projets existants</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Description</th>
            <th scope="col">Créé le</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>{project.description}</td>
              <td>{new Date(project.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
