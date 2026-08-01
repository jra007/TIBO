import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import type { Permission } from '../rbac/permissions';
import { RbacService } from '../rbac/rbac.service';
import { ColumnProfilerService } from '../relations/column-profiler.service';
import { collectFieldRefs, compileFormula, FormulaError, parseFormula, type FormulaDtype } from './formula';
import { quickStatNeedsOrderField, type QuickStatField } from './quick-stats';
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
  quickStatFields: QuickStatField[];
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
  quickStatFields: QuickStatField[];
}

interface ViewRow {
  id: string;
  owner_id: string;
  name: string;
  chart_type: ChartType;
  shelves: ShelfDefinition;
  calculated_fields: CalculatedField[];
  quick_stat_fields: QuickStatField[];
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
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, input: CreateViewInput): Promise<SavedView> {
    const calculatedFields = input.calculatedFields ?? [];
    const quickStatFields = input.quickStatFields ?? [];
    const calculatedFieldTables = await this.validateCalculatedFields(calculatedFields);
    this.validateQuickStatFields(quickStatFields, input.shelves);
    if (calculatedFields.length > 0) await this.requirePermission(ownerId, 'field:calculated:create');
    const tablesUsed = [...new Set([...extractTablesUsed(input.shelves), ...calculatedFieldTables])];
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .insert({
        owner_id: ownerId,
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        calculated_fields: JSON.stringify(calculatedFields),
        quick_stat_fields: JSON.stringify(quickStatFields),
        tables_used: JSON.stringify(tablesUsed),
        relation_ids: JSON.stringify(relationIds),
        visibility: 'private',
        shared_with_group_id: null,
      })
      .returning('*');

    for (const field of calculatedFields) {
      await this.audit.record({ actorUserId: ownerId, action: 'calculated_field.create', target: `views/${row.id}`, after: field });
    }
    return this.toDomain(row);
  }

  /** Only the owner can edit their own view — re-pins relations since the shelves may reference different tables now. */
  async update(viewId: string, ownerId: string, input: CreateViewInput): Promise<SavedView> {
    const existing: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!existing) throw new NotFoundException(`View ${viewId} not found`);
    if (existing.owner_id !== ownerId) throw new ForbiddenException("Vous n'êtes pas propriétaire de cette vue");

    const calculatedFields = input.calculatedFields ?? [];
    const quickStatFields = input.quickStatFields ?? [];
    const calculatedFieldTables = await this.validateCalculatedFields(calculatedFields);
    this.validateQuickStatFields(quickStatFields, input.shelves);

    const calculatedFieldChanges = diffCalculatedFields(existing.calculated_fields, calculatedFields);
    if (calculatedFieldChanges.some((c) => c.action === 'create')) await this.requirePermission(ownerId, 'field:calculated:create');
    if (calculatedFieldChanges.some((c) => c.action === 'update' || c.action === 'delete')) await this.requirePermission(ownerId, 'field:calculated:edit');

    const tablesUsed = [...new Set([...extractTablesUsed(input.shelves), ...calculatedFieldTables])];
    const relationIds = await this.pinRelationsForTablePairs(tablesUsed);

    const [row]: ViewRow[] = await this.knex('views')
      .where({ id: viewId })
      .update({
        name: input.name,
        chart_type: input.chartType,
        shelves: JSON.stringify(input.shelves),
        calculated_fields: JSON.stringify(calculatedFields),
        quick_stat_fields: JSON.stringify(quickStatFields),
        tables_used: JSON.stringify(tablesUsed),
        relation_ids: JSON.stringify(relationIds),
        updated_at: new Date(),
      })
      .returning('*');

    for (const change of calculatedFieldChanges) {
      await this.audit.record({
        actorUserId: ownerId,
        action: `calculated_field.${change.action}`,
        target: `views/${viewId}`,
        before: change.before ?? undefined,
        after: change.action === 'delete' ? undefined : change.field,
      });
    }
    return this.toDomain(row);
  }

  /** Throws unless the user holds `permission` — the decorator-based guard only covers the whole
   * route (view:create), but calculated-field creation/editing needs its own, narrower check since
   * it depends on what's actually in the payload (a view update with no calculated-field changes
   * shouldn't require field:calculated:edit at all). */
  private async requirePermission(userId: string, permission: Permission): Promise<void> {
    const granted = await this.rbac.getPermissionsForUser(userId);
    if (!granted.includes(permission)) {
      throw new ForbiddenException(`Permission manquante : ${permission}`);
    }
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

  /**
   * Live preview of a calculated field's result on a small data sample, before the field is even
   * saved (addendum's "aperçu du résultat" requirement). Reuses the exact same parse/compile path
   * as a real query — a formula that previews correctly behaves identically once saved. Scoped to
   * formulas referencing a single table: a formula spanning multiple tables needs the same
   * relation-walking `buildViewDataQuery` does for a real view, which doesn't exist yet at preview
   * time (no view has been saved to pin relations on) — those return a clear message instead of a
   * best-effort join guess.
   */
  async previewCalculatedField(formula: string, dtype: FormulaDtype): Promise<{ rows: unknown[]; error?: string }> {
    const schemas = await this.columnProfiler.listTableSchemas();
    const availableFields = schemas.flatMap((table) => table.columns.map((column) => ({ tableName: table.tableName, columnName: column.columnName })));

    let ast;
    try {
      ast = parseFormula(formula, availableFields);
    } catch (error) {
      return { rows: [], error: error instanceof FormulaError ? error.message : 'Formule invalide.' };
    }

    const tables = [...new Set(collectFieldRefs(ast).map((ref) => ref.tableName))];
    if (tables.length === 0) return { rows: [], error: 'La formule ne référence aucun champ — impossible de générer un aperçu.' };
    if (tables.length > 1) return { rows: [], error: 'Aperçu indisponible pour une formule combinant plusieurs fichiers — il sera visible après sauvegarde de la vue.' };

    try {
      const { sql, bindings } = compileFormula(formula, dtype, null);
      const rows: { value: unknown }[] = await this.knex(tables[0])
        .select(this.knex.raw(`${sql} as value`, bindings))
        .limit(10);
      return { rows: rows.map((row) => row.value) };
    } catch {
      return { rows: [], error: "Erreur lors du calcul de l'aperçu — vérifiez la formule." };
    }
  }

  /**
   * A quick stat's source/order fields must already be placed on a shelf (that's how the UI
   * offers them — right-click on a field already in the view), so there are no new tables to
   * join here, unlike calculated fields. Purely a shape/reference check.
   */
  private validateQuickStatFields(quickStatFields: QuickStatField[], shelves: ShelfDefinition): void {
    if (quickStatFields.length === 0) return;

    const placedFields = [...shelves.rows, ...shelves.columns, ...shelves.color, ...shelves.size];
    const isPlaced = (ref: { tableName: string; columnName: string; aggregation?: Aggregation }): boolean =>
      placedFields.some((f) => f.tableName === ref.tableName && f.columnName === ref.columnName && f.aggregation === ref.aggregation);

    for (const field of quickStatFields) {
      if (!isPlaced(field.sourceField)) {
        throw new BadRequestException(`Calcul rapide "${field.label}" : le champ source n'est plus présent dans la vue.`);
      }
      if (quickStatNeedsOrderField(field.kind)) {
        if (!field.orderField) throw new BadRequestException(`Calcul rapide "${field.label}" : un champ de tri (axe temporel) est requis.`);
        if (!isPlaced(field.orderField)) {
          throw new BadRequestException(`Calcul rapide "${field.label}" : le champ de tri n'est plus présent dans la vue.`);
        }
      }
      if (field.kind === 'moving_average' && (!field.windowSize || field.windowSize < 1)) {
        throw new BadRequestException(`Calcul rapide "${field.label}" : la taille de fenêtre doit être un entier positif.`);
      }
    }
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

  /**
   * Raw underlying data (headers + rows) for live chart/table rendering — see view-query-builder
   * for the no-aggregation caveat. `selectedDate` is the app-wide date selector's current choice
   * (undefined = fall back to each table's own latest import day); it implicitly filters every
   * table's date_ingestion/is_obsolete unless the view already has an explicit date_ingestion
   * filter of its own (see buildViewDataQuery).
   */
  async getData(viewId: string, selectedDate?: string): Promise<{ headers: string[]; headerLabels: string[]; rows: Record<string, unknown>[] }> {
    const row: ViewRow | undefined = await this.knex('views').where({ id: viewId }).first();
    if (!row) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(
      this.knex,
      row.shelves,
      row.relation_ids,
      row.calculated_fields,
      row.quick_stat_fields,
      selectedDate,
    );
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
      quickStatFields: row.quick_stat_fields,
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

interface CalculatedFieldChange {
  action: 'create' | 'update' | 'delete';
  field: CalculatedField;
  before: CalculatedField | null;
}

/** Matched by id — a field's own identity never changes, only its label/formula/dtype. Feeds both the RBAC gate (create vs. edit needs different permissions) and the audit trail (before/after per field). */
function diffCalculatedFields(before: CalculatedField[], after: CalculatedField[]): CalculatedFieldChange[] {
  const beforeById = new Map(before.map((f) => [f.id, f]));
  const afterIds = new Set(after.map((f) => f.id));
  const changes: CalculatedFieldChange[] = [];

  for (const field of after) {
    const prior = beforeById.get(field.id);
    if (!prior) changes.push({ action: 'create', field, before: null });
    else if (prior.formula !== field.formula || prior.label !== field.label || prior.dtype !== field.dtype) {
      changes.push({ action: 'update', field, before: prior });
    }
  }
  for (const field of before) {
    if (!afterIds.has(field.id)) changes.push({ action: 'delete', field, before: field });
  }
  return changes;
}
