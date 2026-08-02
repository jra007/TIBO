import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import type { ViewVisibility } from '../views/views.service';

export type DashboardTileSize = 'small' | 'medium' | 'large';

/** Keyed by view id. A tile with no entry (every pre-existing dashboard, before this feature) falls back to 'medium' client-side. */
export type DashboardLayout = Record<string, { size: DashboardTileSize }>;

export interface Dashboard {
  id: string;
  ownerId: string;
  name: string;
  viewIds: string[];
  layout: DashboardLayout;
  /** This dashboard's own width on the /dashboards list page (1/2/3 of a fixed 3-column grid) — distinct from `layout`, which sizes each view tile inside the dashboard's own detail page. */
  cardSize: DashboardTileSize;
  /** Position among this owner's dashboards on the list page, lower = earlier. */
  sortOrder: number;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  createdAt: Date;
}

interface DashboardRow {
  id: string;
  owner_id: string;
  name: string;
  view_ids: string[];
  layout: DashboardLayout;
  card_size: DashboardTileSize;
  sort_order: number;
  visibility: ViewVisibility;
  shared_with_group_id: string | null;
  created_at: Date;
}

function toDomain(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    viewIds: row.view_ids,
    layout: row.layout,
    cardSize: row.card_size,
    sortOrder: row.sort_order,
    visibility: row.visibility,
    sharedWithGroupId: row.shared_with_group_id,
    createdAt: row.created_at,
  };
}

@Injectable()
export class DashboardsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(ownerId: string, name: string, viewIds: string[], layout?: DashboardLayout, cardSize?: DashboardTileSize): Promise<Dashboard> {
    if (viewIds.length > 0) {
      const existing = await this.knex('views').whereIn('id', viewIds).pluck('id');
      const missing = viewIds.filter((id) => !existing.includes(id));
      if (missing.length > 0) throw new BadRequestException(`Unknown view id(s): ${missing.join(', ')}`);
    }

    // New dashboard always lands last in this owner's own order — never inserted in the middle.
    const { max } = (await this.knex('dashboards').where({ owner_id: ownerId }).max('sort_order as max').first()) ?? { max: null };
    const nextSortOrder = max === null ? 0 : Number(max) + 1;

    const [row]: DashboardRow[] = await this.knex('dashboards')
      .insert({
        owner_id: ownerId,
        name,
        view_ids: JSON.stringify(viewIds),
        layout: JSON.stringify(layout ?? {}),
        card_size: cardSize ?? 'medium',
        sort_order: nextSortOrder,
        visibility: 'private',
        shared_with_group_id: null,
      })
      .returning('*');
    return toDomain(row);
  }

  /**
   * Only the owner can edit their own dashboard — lets the set of included views (and the name)
   * change after creation. `layout`/`cardSize` are separate from the name/view-selection form
   * that calls this without ever knowing about either — omitting them here leaves whatever's
   * already stored untouched, rather than wiping it back to a default on every unrelated edit.
   */
  async update(
    dashboardId: string,
    ownerId: string,
    name: string,
    viewIds: string[],
    layout?: DashboardLayout,
    cardSize?: DashboardTileSize,
  ): Promise<Dashboard> {
    const existing: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!existing) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de ce tableau de bord");

    if (viewIds.length > 0) {
      const found = await this.knex('views').whereIn('id', viewIds).pluck('id');
      const missing = viewIds.filter((id) => !found.includes(id));
      if (missing.length > 0) throw new BadRequestException(`Unknown view id(s): ${missing.join(', ')}`);
    }

    const updatePayload: Record<string, unknown> = { name, view_ids: JSON.stringify(viewIds), updated_at: new Date() };
    if (layout !== undefined) updatePayload.layout = JSON.stringify(layout);
    if (cardSize !== undefined) updatePayload.card_size = cardSize;

    const [row]: DashboardRow[] = await this.knex('dashboards').where({ id: dashboardId }).update(updatePayload).returning('*');
    return toDomain(row);
  }

  async getById(dashboardId: string): Promise<Dashboard> {
    const row: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!row) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    return toDomain(row);
  }

  async listMine(ownerId: string): Promise<Dashboard[]> {
    const rows: DashboardRow[] = await this.knex('dashboards').where({ owner_id: ownerId }).orderBy('sort_order', 'asc');
    return rows.map(toDomain);
  }

  /**
   * Swaps this dashboard's position with its immediate neighbor in the requested direction —
   * the same "move one step" interaction as a dashboard's own tile reordering, just applied to
   * dashboards themselves instead of the views inside one. A no-op at either end of the list.
   */
  async reorder(dashboardId: string, ownerId: string, direction: 'up' | 'down'): Promise<Dashboard[]> {
    const existing: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!existing) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de ce tableau de bord");

    const neighbor: DashboardRow | undefined = await this.knex('dashboards')
      .where({ owner_id: ownerId })
      .andWhere('sort_order', direction === 'up' ? '<' : '>', existing.sort_order)
      .orderBy('sort_order', direction === 'up' ? 'desc' : 'asc')
      .first();

    if (neighbor) {
      await this.knex.transaction(async (trx) => {
        await trx('dashboards').where({ id: existing.id }).update({ sort_order: neighbor.sort_order });
        await trx('dashboards').where({ id: neighbor.id }).update({ sort_order: existing.sort_order });
      });
    }

    return this.listMine(ownerId);
  }

  async listTeamWorkspace(groupId: string): Promise<Dashboard[]> {
    const rows: DashboardRow[] = await this.knex('dashboards')
      .where({ shared_with_group_id: groupId, visibility: 'shared' })
      .orderBy('created_at', 'desc');
    return rows.map(toDomain);
  }

  /** Same visibility/sharing rules as views.service — requires view:share per spec section 3.1.3.
   * Also re-shareable to a different group at any time, and reversible via unshare(). */
  async shareWithGroup(dashboardId: string, ownerId: string, groupId: string): Promise<Dashboard> {
    const existing: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!existing) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de ce tableau de bord");

    const [row]: DashboardRow[] = await this.knex('dashboards')
      .where({ id: dashboardId })
      .update({ visibility: 'shared', shared_with_group_id: groupId, updated_at: new Date() })
      .returning('*');
    return toDomain(row);
  }

  /** Reverts a shared dashboard back to private. */
  async unshare(dashboardId: string, ownerId: string): Promise<Dashboard> {
    const existing: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!existing) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de ce tableau de bord");

    const [row]: DashboardRow[] = await this.knex('dashboards')
      .where({ id: dashboardId })
      .update({ visibility: 'private', shared_with_group_id: null, updated_at: new Date() })
      .returning('*');
    return toDomain(row);
  }

  /** Deletes the dashboard itself only — the views it includes are untouched, exactly like removing a view from the dashboard's selection already does. */
  async delete(dashboardId: string, ownerId: string): Promise<void> {
    const existing: DashboardRow | undefined = await this.knex('dashboards').where({ id: dashboardId }).first();
    if (!existing) throw new NotFoundException(`Dashboard ${dashboardId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de ce tableau de bord");

    await this.knex('dashboards').where({ id: dashboardId }).delete();
  }
}
