import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { buildViewDataQuery } from './view-query-builder';

export type ChartType = 'bar' | 'line' | 'scatter' | 'heatmap' | 'table' | 'geo';
export type ViewVisibility = 'private' | 'shared';
export type ViewRelationStatus = 'validated' | 'pending' | 'to_fix';

export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface FieldRef {
  tableName: string;
  columnName: string;
  /** Set only for numeric fields used as a measure — matches spec 3.1.3's per-measure aggregation. Absent = dimension. */
  aggregation?: Aggregation;
}

export interface ShelfDefinition {
  rows: FieldRef[];
  columns: FieldRef[];
  color: FieldRef[];
  size: FieldRef[];
  filters: FieldRef[];
}

export interface SavedView {
  id: string;
  ownerId: string;
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  relationStatus: ViewRelationStatus;
}

export interface CreateViewInput {
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
}

interface ViewRow {
  id: string;
  owner_id: string;
  name: string;
  chart_type: ChartType;
  shelves: ShelfDefinition;
  tables_used: string[];
  relation_ids: string[];
  visibility: ViewVisibility;
  shared_with_group_id: string | null;
}

@Injectable()
export class ViewsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(ownerId: string, input: CreateViewInput): Promise<SavedView> {
    const tablesUsed = extractTablesUsed(input.shelves);
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .insert({
        owner_id: ownerId,
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        tables_used: JSON.stringify(tablesUsed),
        relation_ids: JSON.stringify(relationIds),
        visibility: 'private',
        shared_with_group_id: null,
      })
      .returning('*');
    return this.toDomain(row);
  }

  /** Only the owner can edit their own view — re-pins relations since the shelves may reference different tables now. */
  async update(viewId: string, ownerId: string, input: CreateViewInput): Promise<SavedView> {
    const existing: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!existing) throw new NotFoundException(`View ${viewId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de cette vue");

    const tablesUsed = extractTablesUsed(input.shelves);
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        tables_used: JSON.stringify(tablesUsed),
        relation_ids: JSON.stringify(relationIds),
        updated_at: new Date(),
      })
      .returning('*');
    return this.toDomain(row);
  }

  async getById(viewId: string): Promise<SavedView> {
    const row: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!row) throw new NotFoundException(`View ${viewId} not found`);
    return this.toDomain(row);
  }

  /** Private views owned by this user, regardless of whether they were later shared — the owner always sees their own work. */
  async listMine(ownerId: string): Promise<SavedView[]> {
    const rows: ViewRow[] = await this.knex('views').where({ owner_id: ownerId }).orderBy('created_at', 'desc');
    return Promise.all(rows.map((row) => this.toDomain(row)));
  }

  /** Views explicitly shared with a group's team workspace. */
  async listTeamWorkspace(groupId: string): Promise<SavedView[]> {
    const rows: ViewRow[] = await this.knex('views')
      .where({ shared_with_group_id: groupId, visibility: 'shared' })
      .orderBy('created_at', 'desc');
    return Promise.all(rows.map((row) => this.toDomain(row)));
  }

  /** Raw underlying data (headers + rows) for live chart/table rendering — see view-query-builder for the no-aggregation caveat. */
  async getData(viewId: string): Promise<{ headers: string[]; headerLabels: string[]; rows: Record<string, unknown>[] }> {
    const row: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!row) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(this.knex, row.shelves, row.relation_ids);
    const rows = await query;
    return { headers, headerLabels, rows: rows.map(mapRow) };
  }

  /** Requires view:share in addition to view:create — kept as a distinct permission per spec. */
  async shareWithGroup(viewId: string, groupId: string): Promise<SavedView> {
    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({ visibility: 'shared', shared_with_group_id: groupId, updated_at: new Date() })
      .returning('*');
    if (!row) throw new NotFoundException(`View ${viewId} not found`);
    return this.toDomain(row);
  }

  /**
   * Picks the single highest-confidence candidate relation for each distinct pair of tables used
   * in the view, and pins its id. This is "the relation the view was built on" (spec section
   * 3.1.3) — without pinning a specific row, a table pair with several proposed column-pair
   * candidates (common, since scoring considers every column combination) has no well-defined
   * single status to track.
   */
  private async pinRelationsForTablePairs(tablesUsed: string[]): Promise<string[]> {
    const relationIds: string[] = [];
    for (let i = 0; i < tablesUsed.length; i++) {
      for (let j = i + 1; j < tablesUsed.length; j++) {
        const best = await this.knex('detected_relations')
          .where({ source_table: tablesUsed[i], target_table: tablesUsed[j] })
          .orWhere({ source_table: tablesUsed[j], target_table: tablesUsed[i] })
          .orderBy('confidence_score', 'desc')
          .first();
        if (best) relationIds.push(best.id);
      }
    }
    return relationIds;
  }

  private async toDomain(row: ViewRow): Promise<SavedView> {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      chartType: row.chart_type,
      shelves: row.shelves,
      visibility: row.visibility,
      sharedWithGroupId: row.shared_with_group_id,
      relationStatus: await this.computeRelationStatus(row.tables_used, row.relation_ids),
    };
  }

  /**
   * "Statut relation" is derived live from detected_relations, never stored — a view's status
   * must reflect the current state of the relations it depends on (validated / still proposed /
   * rejected after the fact), per spec section 3.1.3.
   */
  private async computeRelationStatus(tablesUsed: string[], relationIds: string[]): Promise<ViewRelationStatus> {
    if (tablesUsed.length <= 1) return 'validated';

    const pairCount = (tablesUsed.length * (tablesUsed.length - 1)) / 2;
    // Some table pair had no candidate relation at all when the view was created — someone still
    // needs to establish one, so treat it the same as "proposed but not yet validated".
    let worst: ViewRelationStatus = relationIds.length < pairCount ? 'pending' : 'validated';

    if (relationIds.length > 0) {
      const relations = await this.knex('detected_relations').whereIn('id', relationIds);
      for (const relation of relations) {
        const pairStatus: ViewRelationStatus = relation.status === 'rejected' ? 'to_fix' : relation.status === 'proposed' ? 'pending' : 'validated';
        if (pairStatus === 'to_fix') worst = 'to_fix';
        else if (pairStatus === 'pending' && worst !== 'to_fix') worst = 'pending';
      }
    }
    return worst;
  }
}

function extractTablesUsed(shelves: ShelfDefinition): string[] {
  const allFields = [...shelves.rows, ...shelves.columns, ...shelves.color, ...shelves.size, ...shelves.filters];
  return [...new Set(allFields.map((field) => field.tableName))];
}
