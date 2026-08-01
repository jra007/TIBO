import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

export interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

interface GroupRow {
  id: string;
  name: string;
  description: string;
  created_at: Date;
}

function toDomain(row: GroupRow): Group {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at };
}

@Injectable()
export class GroupsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(name: string, description: string): Promise<Group> {
    const [row]: GroupRow[] = await this.knex('groups').insert({ name, description }).returning('*');
    return toDomain(row);
  }

  async list(): Promise<Group[]> {
    const rows: GroupRow[] = await this.knex('groups').select('*').orderBy('name');
    return rows.map(toDomain);
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    await this.knex('user_group').insert({ group_id: groupId, user_id: userId }).onConflict(['user_id', 'group_id']).ignore();
  }

  /** Assigns a role's permissions to every member of a group — see role_assignment.group_id. */
  async assignRole(groupId: string, roleId: string): Promise<void> {
    await this.knex('role_assignment').insert({ group_id: groupId, role_id: roleId });
  }
}
