import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { AdminUser, Group, Role } from '../../api/types';

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberGroupId, setMemberGroupId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [roleGroupId, setRoleGroupId] = useState('');
  const [roleId, setRoleId] = useState('');
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

  async function handleAddMember() {
    if (!memberGroupId || !memberId) return;
    await apiClient.post(`/admin/settings/groups/${memberGroupId}/members`, { userId: memberId });
    setMemberId('');
    await refresh();
  }

  async function handleAssignRole() {
    if (!roleGroupId || !roleId) return;
    await apiClient.post(`/admin/settings/groups/${roleGroupId}/roles`, { roleId });
    setRoleId('');
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
        <h3>Créer un groupe</h3>
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
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td>{group.name}</td>
              <td>{group.description}</td>
              <td>{new Date(group.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Ajouter un membre à un groupe</h3>
      <label htmlFor="member-group">Groupe</label>
      <select id="member-group" value={memberGroupId} onChange={(e) => setMemberGroupId(e.target.value)}>
        <option value="">Choisir un groupe</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <label htmlFor="member-user">Utilisateur</label>
      <select id="member-user" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
        <option value="">Choisir un utilisateur</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAddMember} disabled={!memberGroupId || !memberId}>
        Ajouter
      </button>

      <h3>Assigner un rôle à un groupe</h3>
      <label htmlFor="group-role-group">Groupe</label>
      <select id="group-role-group" value={roleGroupId} onChange={(e) => setRoleGroupId(e.target.value)}>
        <option value="">Choisir un groupe</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <label htmlFor="group-role-role">Rôle</label>
      <select id="group-role-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
        <option value="">Choisir un rôle</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAssignRole} disabled={!roleGroupId || !roleId}>
        Assigner
      </button>
    </section>
  );
}
