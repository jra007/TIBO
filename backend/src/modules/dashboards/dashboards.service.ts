import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import type { ViewVisibility } from '../views/views.service';

export interface Dashboard {
  id: string;
  ownerId: string;
  name: string;
  viewIds: string[];
  layout: unknown;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
}

interface DashboardRow {
  id: string;
  owner_id: string;
  name: string;
  view_ids: string[];
  layout: unknown;
  visibility: ViewVisibility;
  shared_with_group_id: string | null;
}

function toDomain(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    viewIds: row.view_ids,
    layout: row.layout,
    visibility: row.visibility,
    sharedWithGroupId: row.shared_with_group_id,
  };
}

@Injectable()
export class DashboardsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(ownerId: string, name: string, viewIds: string[], layout: unknown): Promise<Dashboard> {
    if (viewIds.length > 0) {
      const existing = await this.knex('views').whereIn('id', viewIds).pluck('id');
      const missing = viewIds.filter((id) => !existing.includes(id));
      if (missing.length > 0) throw new BadRequestException(`Unknown view id(s): ${missing.join(', ')}`);
    }

    const [row]: DashboardRow[] = await this.knex('dashboards')
      .insert({
        owner_id: ownerId,
        name,
        view_ids: JSON.stringify(viewIds),
        layout: JSON.stringify(layout ?? {}),
        visibility: 'private',
        shared_with_group_id: null,
      })
      .returning('*');
    return toDomain(row);
  }

  async getById(dashboardId: string): Promise<Dashboard> {
    const row: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!row) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    return toDomain(row);
  }

  async listMine(ownerId: string): Promise<Dashboard[]> {
    const rows: DashboardRow[] = await this.knex('dashboards').where({ owner_id: ownerId }).orderBy('created_at', 'desc');
    return rows.map(toDomain);
  }

  async listTeamWorkspace(groupId: string): Promise<Dashboard[]> {
    const rows: DashboardRow[] = await this.knex('dashboards')
      .where({ shared_with_group_id: groupId, visibility: 'shared' })
      .orderBy('created_at', 'desc');
    return rows.map(toDomain);
  }

  /** Same visibility/sharing rules as views.service — requires view:share per spec section 3.1.3. */
  async shareWithGroup(dashboardId: string, groupId: string): Promise<Dashboard> {
    const [row]: DashboardRow[] = await this.knex('dashboards')
      .where({ id: dashboardId })
      .update({ visibility: 'shared', shared_with_group_id: groupId, updated_at: new Date() })
      .returning('*');
    if (!row) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    return toDomain(row);
  }
}
