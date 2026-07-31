import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { Permission } from './permissions';

@Injectable()
export class RbacService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** Union of permissions granted via roles assigned directly to the user, or to any group they belong to. */
  async getPermissionsForUser(userId: string): Promise<Permission[]> {
    const rows: { permission: Permission }[] = await this.knex('role_permission as rp')
      .join('role_assignment as ra', 'ra.role_id', 'rp.role_id')
      .where('ra.user_id', userId)
      .orWhereIn('ra.group_id', this.knex('user_group').select('group_id').where('user_id', userId))
      .distinct('rp.permission');

    return rows.map((row) => row.permission);
  }
}
