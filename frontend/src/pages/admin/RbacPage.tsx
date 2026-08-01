import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { PERMISSIONS, type AdminUser, type Permission, type Role } from '../../api/types';

const PERMISSION_LABELS: Record<Permission, string> = {
  'view:read': 'Consulter une vue',
  'view:create': 'Créer une vue',
  'view:share': 'Partager une vue',
  'export:pdf': 'Exporter en PDF',
  'export:excel': 'Exporter en Excel',
  'relation:validate': 'Valider les relations détectées',
  'settings:access': 'Accéder au menu paramétrage',
  'settings:retention:edit': 'Modifier la rétention',
  'settings:rbac:edit': 'Gérer les rôles et permissions',
  'settings:reset:execute': 'Réinitialiser toutes les données',
  'ingestion:manage': "Supprimer l'historique d'ingestion",
  'settings:appearance:edit': "Modifier l'apparence",
};

export function RbacPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [rolesResult, usersResult] = await Promise.all([
        apiClient.get<Role[]>('/admin/settings/roles'),
        apiClient.get<AdminUser[]>('/admin/settings/users'),
      ]);
      setRoles(rolesResult);
      setUsers(usersResult);
    } catch {
      setError('Impossible de charger les rôles.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function togglePermission(permission: Permission) {
    setPermissions((prev) => (prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]));
  }

  async function handleCreateRole(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/admin/settings/roles', { name, description, permissions });
    setName('');
    setDescription('');
    setPermissions([]);
    await refresh();
  }

  async function handleAssign() {
    if (!assignRoleId || !assignUserId) return;
    await apiClient.post(`/admin/settings/roles/${assignRoleId}/users/${assignUserId}`);
    setAssignRoleId('');
    setAssignUserId('');
  }

  return (
    <section>
      <h2>Permissions (RBAC)</h2>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleCreateRole}>
        <h3>Créer un rôle</h3>
        <label htmlFor="role-name">Nom</label>
        <input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="role-description">Description</label>
        <input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset>
          <legend>Permissions</legend>
          {PERMISSIONS.map((permission) => (
            <label key={permission}>
              <input type="checkbox" checked={permissions.includes(permission)} onChange={() => togglePermission(permission)} />
              {PERMISSION_LABELS[permission]}
            </label>
          ))}
        </fieldset>
        <button type="submit">Créer le rôle</button>
      </form>

      <table>
        <caption>Rôles existants</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Description</th>
            <th scope="col">Créé le</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>{role.description}</td>
              <td>{new Date(role.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Assigner un rôle à un utilisateur</h3>
      <label htmlFor="assign-role">Rôle</label>
      <select id="assign-role" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
        <option value="">Choisir un rôle</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <label htmlFor="assign-user">Utilisateur</label>
      <select id="assign-user" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
        <option value="">Choisir un utilisateur</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAssign} disabled={!assignRoleId || !assignUserId}>
        Assigner
      </button>
    </section>
  );
}
