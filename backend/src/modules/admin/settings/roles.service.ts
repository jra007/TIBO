import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import type { Permission } from '../../rbac/permissions';

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

@Injectable()
export class RolesService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(name: string, description: string | undefined, permissions: Permission[]): Promise<Role> {
    const [role] = await this.knex('roles').insert({ name, description }).returning('*');
    if (permissions.length > 0) {
      await this.knex('role_permission').insert(permissions.map((permission) => ({ role_id: role.id, permission })));
    }
    return role;
  }

  async list(): Promise<Role[]> {
    return this.knex('roles').select('*').orderBy('name');
  }

  /** Assigns a role directly to an individual user, independent of any group membership. */
  async assignToUser(roleId: string, userId: string): Promise<void> {
    await this.knex('role_assignment').insert({ role_id: roleId, user_id: userId });
  }
}
