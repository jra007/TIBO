import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { ColumnProfilerService } from '../relations/column-profiler.service';
import { collectFieldRefs, FormulaError, parseFormula, type FormulaDtype } from './formula';
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

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between';

export interface FilterCondition {
  tableName: string;
  columnName: string;
  operator: FilterOperator;
  value: string | null;
  /** Only used for 'between'. */
  value2?: string | null;
}

export interface ShelfDefinition {
  rows: FieldRef[];
  columns: FieldRef[];
  color: FieldRef[];
  size: FieldRef[];
  filters: FilterCondition[];
}

/**
 * A field derived from a formula rather than stored directly — addressed on shelves the same way
 * as a real column, via a synthetic tableName ('_calc') and columnName (this field's id), so it's
 * a drop-in "field" everywhere a FieldRef is accepted. Cannot reference another calculated field
 * (see formula.ts) — that rules out cycles by construction, not by detection.
 */
export interface CalculatedField {
  id: string;
  label: string;
  formula: string;
  dtype: FormulaDtype;
}

export const CALCULATED_FIELD_TABLE = '_calc';

export interface SavedView {
  id: string;
  ownerId: string;
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
  calculatedFields: CalculatedField[];
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  relationStatus: ViewRelationStatus;
  createdAt: Date;
}

export interface CreateViewInput {
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
  calculatedFields: CalculatedField[];
}

interface ViewRow {
  id: string;
  owner_id: string;
  name: string;
  chart_type: ChartType;
  shelves: ShelfDefinition;
  calculated_fields: CalculatedField[];
  tables_used: string[];
  relation_ids: string[];
  visibility: ViewVisibility;
  shared_with_group_id: string | null;
  created_at: Date;
}

@Injectable()
export class ViewsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly columnProfiler: ColumnProfilerService,
  ) {}

  async create(ownerId: string, input: CreateViewInput): Promise<SavedView> {
    const calculatedFields = input.calculatedFields ?? [];
    const calculatedFieldTables = await this.validateCalculatedFields(calculatedFields);
    const tablesUsed = [...new Set([...extractTablesUsed(input.shelves), ...calculatedFieldTables])];
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .insert({
        owner_id: ownerId,
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        calculated_fields: JSON.stringify(calculatedFields),
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

    const calculatedFields = input.calculatedFields ?? [];
    const calculatedFieldTables = await this.validateCalculatedFields(calculatedFields);
    const tablesUsed = [...new Set([...extractTablesUsed(input.shelves), ...calculatedFieldTables])];
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        calculated_fields: JSON.stringify(calculatedFields),
        tables_used: JSON.stringify(tablesUsed),
        relation_ids: JSON.stringify(relationIds),
        updated_at: new Date(),
      })
      .returning('*');
    return this.toDomain(row);
  }

  /**
   * Compiles every calculated field against the real available fields (not just the tables
   * already on shelves — a formula can reference a table nothing else in the view displays yet),
   * rejecting the save with a clear message if any formula is invalid. Returns the set of tables
   * the formulas touch, so their relations get pinned too (see create/update above).
   */
  private async validateCalculatedFields(calculatedFields: CalculatedField[]): Promise<string[]> {
    if (calculatedFields.length === 0) return [];

    const schemas = await this.columnProfiler.listTableSchemas();
    const availableFields = schemas.flatMap((table) => table.columns.map((column) => ({ tableName: table.tableName, columnName: column.columnName })));

    const tables = new Set<string>();
    for (const field of calculatedFields) {
      try {
        const ast = parseFormula(field.formula, availableFields);
        for (const ref of collectFieldRefs(ast)) tables.add(ref.tableName);
      } catch (error) {
        const message = error instanceof FormulaError ? error.message : 'Erreur inconnue';
        throw new BadRequestException(`Champ calculé "${field.label}" invalide : ${message}`);
      }
    }
    return [...tables];
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

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(this.knex, row.shelves, row.relation_ids, row.calculated_fields);
    const rows = await query;
    return { headers, headerLabels, rows: rows.map(mapRow) };
  }

  /** Requires view:share in addition to view:create — kept as a distinct permission per spec.
   * Also re-shareable to a different group at any time, and reversible via unshare(). */
  async shareWithGroup(viewId: string, ownerId: string, groupId: string): Promise<SavedView> {
    const existing: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!existing) throw new NotFoundException(`View ${viewId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de cette vue");

    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({ visibility: 'shared', shared_with_group_id: groupId, updated_at: new Date() })
      .returning('*');
    return this.toDomain(row);
  }

  /** Reverts a shared view back to private. */
  async unshare(viewId: string, ownerId: string): Promise<SavedView> {
    const existing: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!existing) throw new NotFoundException(`View ${viewId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de cette vue");

    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({ visibility: 'private', shared_with_group_id: null, updated_at: new Date() })
      .returning('*');
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
      calculatedFields: row.calculated_fields,
      visibility: row.visibility,
      sharedWithGroupId: row.shared_with_group_id,
      relationStatus: await this.computeRelationStatus(row.tables_used, row.relation_ids),
      createdAt: row.created_at,
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
      // A pinned relation can now be gone entirely (bulk relation delete/reset) — as bad as a
      // rejection for a view that was built on it, so it needs the same "à corriger" treatment.
      if (relations.length < relationIds.length) worst = 'to_fix';
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
