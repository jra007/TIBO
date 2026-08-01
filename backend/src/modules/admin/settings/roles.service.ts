import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import type { Permission } from '../../rbac/permissions';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

function toDomain(row: RoleRow): Role {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at };
}

@Injectable()
export class RolesService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(name: string, description: string | undefined, permissions: Permission[]): Promise<Role> {
    const [role]: RoleRow[] = await this.knex('roles').insert({ name, description }).returning('*');
    if (permissions.length > 0) {
      await this.knex('role_permission').insert(permissions.map((permission) => ({ role_id: role.id, permission })));
    }
    return toDomain(role);
  }

  async list(): Promise<Role[]> {
    const rows: RoleRow[] = await this.knex('roles').select('*').orderBy('name');
    return rows.map(toDomain);
  }

  /** Assigns a role directly to an individual user, independent of any group membership. */
  async assignToUser(roleId: string, userId: string): Promise<void> {
    await this.knex('role_assignment').insert({ role_id: roleId, user_id: userId });
  }
}
