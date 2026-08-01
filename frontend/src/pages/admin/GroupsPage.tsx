import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { AdminUser, Group, Role } from '../../api/types';

function GroupRow({ group, users, roles, onChanged }: { group: Group; users: AdminUser[]; roles: Role[]; onChanged: () => void }) {
  const [memberId, setMemberId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [busy, setBusy] = useState(false);

  async function addMember() {
    if (!memberId) return;
    setBusy(true);
    try {
      await apiClient.post(`/admin/settings/groups/${group.id}/members`, { userId: memberId });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function assignRole() {
    if (!roleId) return;
    setBusy(true);
    try {
      await apiClient.post(`/admin/settings/groups/${group.id}/roles`, { roleId });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{group.name}</td>
      <td>{group.description}</td>
      <td>{new Date(group.createdAt).toLocaleDateString('fr-FR')}</td>
      <td>
        <label htmlFor={`member-${group.id}`}>Ajouter un membre</label>
        <select id={`member-${group.id}`} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Choisir un utilisateur</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
        <button type="button" onClick={addMember} disabled={busy || !memberId}>
          Ajouter
        </button>
      </td>
      <td>
        <label htmlFor={`role-${group.id}`}>Assigner un rôle</label>
        <select id={`role-${group.id}`} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Choisir un rôle</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={assignRole} disabled={busy || !roleId}>
          Assigner
        </button>
      </td>
    </tr>
  );
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [groupsResult, usersResult, rolesResult] = await Promise.all([
        apiClient.get<Group[]>('/admin/settings/groups'),
        apiClient.get<AdminUser[]>('/admin/settings/users'),
        apiClient.get<Role[]>('/admin/settings/roles'),
      ]);
      setGroups(groupsResult);
      setUsers(usersResult);
      setRoles(rolesResult);
    } catch {
      setError('Impossible de charger les groupes.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await apiClient.post('/admin/settings/groups', { name, description });
    setName('');
    setDescription('');
    await refresh();
  }

  return (
    <section>
      <h2>Groupes</h2>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate}>
        <label htmlFor="group-name">Nom</label>
        <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="group-description">Description</label>
        <input id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit">Créer le groupe</button>
      </form>

      <table>
        <caption>Groupes existants</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Description</th>
            <th scope="col">Créé le</th>
            <th scope="col">Membres</th>
            <th scope="col">Rôles</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} users={users} roles={roles} onChanged={refresh} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
