import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { Permission } from './permissions';

@Injectable()
export class RbacService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** Union of permissions granted via roles assigned directly to the user, or to any group they belong to. */
  async getPermissionsForUser(userId: string): Promise<Permission[]> {
    const rows: { permission: Permission }[] = await this.knex(
      'role_permission as rp',
    )
      .join('role_assignment as ra', 'ra.role_id', 'rp.role_id')
      .where('ra.user_id', userId)
      .orWhereIn(
        'ra.group_id',
        this.knex('user_group').select('group_id').where('user_id', userId),
      )
      .distinct('rp.permission');

    return rows.map((row) => row.permission);
  }

  /** Every user holding `permission`, directly or via a group — the reverse of getPermissionsForUser, for "who should be alerted about this" cases (e.g. the ingestion anomaly guard). */
  async listUsersWithPermission(permission: Permission): Promise<string[]> {
    const directUsers = this.knex('role_permission as rp')
      .join('role_assignment as ra', 'ra.role_id', 'rp.role_id')
      .whereNotNull('ra.user_id')
      .where('rp.permission', permission)
      .select('ra.user_id as user_id');

    const groupUsers = this.knex('role_permission as rp')
      .join('role_assignment as ra', 'ra.role_id', 'rp.role_id')
      .join('user_group as ug', 'ug.group_id', 'ra.group_id')
      .whereNotNull('ra.group_id')
      .where('rp.permission', permission)
      .select('ug.user_id as user_id');

    const rows: { user_id: string }[] = await directUsers.union(groupUsers);
    return [...new Set(rows.map((row) => row.user_id))];
  }
}
