import type { Knex } from 'knex';
import { getLabelsMap } from './column-labels';
import { collectFieldRefs, compileFormula, parseFormula } from './formula';
import { compileQuickStatSql, QUICK_STAT_TABLE, type QuickStatField } from './quick-stats';
import type { Aggregation, CalculatedField, FieldRef, FilterCondition, ShelfDefinition } from './views.service';
import { CALCULATED_FIELD_TABLE } from './views.service';

interface RelationRow {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

const SQL_AGGREGATE: Record<Aggregation, string> = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  min: 'MIN',
  max: 'MAX',
};

function dedupeFields(fields: ShelfDefinition['rows']): ShelfDefinition['rows'] {
  const seen = new Set<string>();
  const result: ShelfDefinition['rows'] = [];
  for (const field of fields) {
    const key = `${field.tableName}.${field.columnName}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(field);
    }
  }
  return result;
}

/** Real tables a field touches — itself for a plain column, or its formula's own field references for a calculated one. */
function realTablesFor(field: { tableName: string; columnName: string }, calculatedFieldsById: Map<string, CalculatedField>): string[] {
  if (field.tableName !== CALCULATED_FIELD_TABLE) return [field.tableName];
  const calculatedField = calculatedFieldsById.get(field.columnName);
  if (!calculatedField) return [];
  const ast = parseFormula(calculatedField.formula, null);
  return collectFieldRefs(ast).map((ref) => ref.tableName);
}

/**
 * A field is either a real column (resolves to a plain, safely-escaped identifier) or a
 * calculated field (resolves to its formula, already validated at save time — see
 * ViewsService.validateCalculatedFields — so re-parsing here skips the field-allowlist check).
 */
function resolveFieldSql(knex: Knex, field: { tableName: string; columnName: string }, calculatedFieldsById: Map<string, CalculatedField>): Knex.Raw {
  if (field.tableName === CALCULATED_FIELD_TABLE) {
    const calculatedField = calculatedFieldsById.get(field.columnName);
    if (!calculatedField) throw new Error(`Champ calculé introuvable : ${field.columnName}`);
    const { sql, bindings } = compileFormula(calculatedField.formula, calculatedField.dtype, null);
    return knex.raw(sql, bindings);
  }
  return knex.raw('??', [`${field.tableName}.${field.columnName}`]);
}

/** Ignores a filter missing what it needs (no operator/value yet, or no second value for 'between') rather than erroring — lets a half-filled filter sit on the shelf without breaking the view. */
function applyFilter(query: Knex.QueryBuilder, filter: FilterCondition, columnSql: Knex.Raw): Knex.QueryBuilder {
  if (filter.value == null || filter.value === '') return query;

  switch (filter.operator) {
    case 'eq':
      return query.where(columnSql, '=', filter.value);
    case 'neq':
      return query.where(columnSql, '!=', filter.value);
    case 'gt':
      return query.where(columnSql, '>', filter.value);
    case 'gte':
      return query.where(columnSql, '>=', filter.value);
    case 'lt':
      return query.where(columnSql, '<', filter.value);
    case 'lte':
      return query.where(columnSql, '<=', filter.value);
    case 'contains':
      // whereILike's typings don't accept a Raw column (only whereBetween-style overloads do
      // string/keyof) — .where(raw, operator, value) does, and 'ilike' is the same operator.
      return query.where(columnSql, 'ilike', `%${filter.value}%`);
    case 'between':
      if (filter.value2 == null || filter.value2 === '') return query;
      // Same reasoning: whereBetween has no Raw-accepting overload, so two inclusive comparisons instead.
      return query.where(columnSql, '>=', filter.value).andWhere(columnSql, '<=', filter.value2);
    default:
      return query;
  }
}

/**
 * Builds the query for "the underlying data of a view": the columns placed in
 * rows/columns/color/size, joined across tables via the relations pinned on the view at creation
 * time (ViewsService.pinRelationsForTablePairs). Fields with an `aggregation` set (numeric
 * measures, per spec 3.1.3) are summed/averaged/etc. and GROUP BY the remaining (dimension)
 * fields; if no field has an aggregation, this is a plain projection of raw rows — that's still
 * the common case for a 'table' chart type. The `filters` shelf is applied as WHERE conditions
 * (before any grouping), and can reference a table not otherwise displayed — its table still
 * needs joining, so it's folded into the join-walk below alongside the displayed fields'.
 *
 * A calculated field (tableName === CALCULATED_FIELD_TABLE) can sit on any shelf exactly like a
 * real column — resolveFieldSql compiles its formula into the same position a plain identifier
 * would go. Its formula's own real-table references (not the pseudo "_calc" table itself) join
 * the same way a filter's table does.
 *
 * SQL aliases are synthetic (col_0, col_1, ...), not "table.column" strings: knex's identifier
 * quoting (`??`) splits on '.' to address table.column pairs, so a "table.column"-shaped alias
 * gets silently mis-quoted into two separate identifiers instead of one — a real bug caught by
 * testing, not just a style choice. `mapRow` restores the "table.column" keys the callers expect.
 */
export async function buildViewDataQuery(
  knex: Knex,
  shelves: ShelfDefinition,
  relationIds: string[],
  calculatedFields: CalculatedField[],
  quickStatFields: QuickStatField[] = [],
  /** The global date selector's chosen day (UTC, "YYYY-MM-DD") — undefined falls back per table to
   * that table's own most recent date_ingestion. See applyImplicitDateFilter below. */
  selectedDate?: string,
): Promise<{
  headers: string[];
  headerLabels: string[];
  query: Knex.QueryBuilder;
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
}> {
  const fields = dedupeFields([...shelves.rows, ...shelves.columns, ...shelves.color, ...shelves.size]);
  if (fields.length === 0) throw new Error('Cette vue ne contient aucun champ à afficher');

  const calculatedFieldsById = new Map(calculatedFields.map((f) => [f.id, f]));

  const tables = [...new Set([...fields, ...shelves.filters].flatMap((f) => realTablesFor(f, calculatedFieldsById)))];
  const relations: RelationRow[] = relationIds.length > 0 ? await knex('detected_relations').whereIn('id', relationIds) : [];

  let query = knex(tables[0]);
  const joined = new Set([tables[0]]);
  const remaining = tables.slice(1);

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((table) => relations.some((r) => connectsToJoined(r, joined, table)));
    if (nextIndex === -1) {
      throw new Error(`Impossible de relier la table "${remaining[0]}" aux autres tables de la vue (aucune relation disponible)`);
    }

    const table = remaining[nextIndex];
    const relation = relations.find((r) => connectsToJoined(r, joined, table));
    if (!relation) throw new Error(`Relation introuvable pour la table "${table}"`);

    const [fromTable, fromColumn, toColumn] = joined.has(relation.source_table)
      ? [relation.source_table, relation.source_column, relation.target_column]
      : [relation.target_table, relation.target_column, relation.source_column];

    query = query.join(table, `${fromTable}.${fromColumn}`, `${table}.${toColumn}`);
    joined.add(table);
    remaining.splice(nextIndex, 1);
  }

  for (const filter of shelves.filters) query = applyFilter(query, filter, resolveFieldSql(knex, filter, calculatedFieldsById));

  // Per-table historization filter (addendum: TIBO_addendum_doublons_et_dates.md, point 4): a
  // table becomes append-only history the moment it's re-ingested, so without this every view
  // would silently sum every day ever imported instead of just one snapshot. A table the user has
  // *explicitly* dragged date_ingestion onto (in shelves.filters) is left alone — that's the
  // "compare several dates in one view" escape hatch, and takes precedence over the implicit one.
  const explicitDateFilterTables = new Set(shelves.filters.filter((f) => f.columnName === 'date_ingestion').map((f) => f.tableName));
  for (const table of tables) {
    if (explicitDateFilterTables.has(table)) continue;
    const hasDateIngestion = await knex.schema.hasColumn(table, 'date_ingestion');
    if (!hasDateIngestion) continue;

    // Each table resolves its OWN effective date independently — never an exact match on the
    // globally-selected date applied uniformly. Source files are re-ingested on their own,
    // uncoordinated schedules (one file re-uploaded today, others not touched in days), so
    // requiring every joined table to have a row on the exact same day would empty out any
    // multi-table view the moment just one of its tables gets ahead of the others. "As of" the
    // selected date means each table's own latest data at or before that date.
    const effectiveDate = await resolveLatestDate(knex, table, selectedDate);
    if (effectiveDate) {
      query = query.andWhere(`${table}.date_ingestion`, effectiveDate).andWhere(`${table}.is_obsolete`, false);
    } else if (selectedDate) {
      // A specific date was requested and this table has no data at or before it: the table
      // genuinely contributes nothing to this query. Skipping the filter here (as when there's no
      // selectedDate and the table is simply empty) would wrongly join in its *entire* unfiltered
      // history instead of correctly returning no rows for it.
      query = query.whereRaw('1 = 0');
    }
    // else: no selectedDate given and the table has no rows at all yet — nothing to filter, an
    // empty table is empty either way.
  }

  const realFields = fields.filter((f) => f.tableName !== CALCULATED_FIELD_TABLE);
  const labelsMap = await getLabelsMap(knex, realFields);

  const headers = fields.map((f) => `${f.tableName}.${f.columnName}`);
  const headerLabels = fields.map((f) =>
    f.tableName === CALCULATED_FIELD_TABLE
      ? (calculatedFieldsById.get(f.columnName)?.label ?? f.columnName)
      : (labelsMap.get(`${f.tableName}.${f.columnName}`) ?? f.columnName),
  );
  const aliases = fields.map((_, i) => `col_${i}`);
  const findAlias = (ref: FieldRef): string => {
    const index = fields.findIndex((f) => f.tableName === ref.tableName && f.columnName === ref.columnName && f.aggregation === ref.aggregation);
    if (index === -1) throw new Error(`Champ introuvable pour le calcul rapide : ${ref.tableName}.${ref.columnName}`);
    return aliases[index];
  };
  const dimensionFields = fields.filter((f) => !f.aggregation);
  const measureFields = fields.filter((f) => f.aggregation);

  if (measureFields.length === 0) {
    const selectExpr = fields.map((f, i) => knex.raw('? as ??', [resolveFieldSql(knex, f, calculatedFieldsById), aliases[i]]));
    query = query.select(selectExpr);
  } else {
    const selectExpr = fields.map((f, i) => {
      const source = resolveFieldSql(knex, f, calculatedFieldsById);
      return f.aggregation ? knex.raw(`${SQL_AGGREGATE[f.aggregation]}(?) as ??`, [source, aliases[i]]) : knex.raw('? as ??', [source, aliases[i]]);
    });
    query = query.select(selectExpr);
    if (dimensionFields.length > 0) {
      // Group by the SELECT list's own aliases, not a second copy of the same expression: a
      // recompiled calculated-field formula gets fresh parameter placeholders each time
      // (resolveFieldSql runs again), and Postgres treats two differently-parameterized copies
      // of an otherwise-identical CASE expression as unrelated for GROUP BY validity — "column
      // ... must appear in the GROUP BY clause" even though the text looks the same. Postgres
      // (as an extension beyond standard SQL) allows GROUP BY to reference a SELECT-list alias
      // directly, which reuses the exact same parsed expression instead of a second one.
      const dimensionAliases = fields.flatMap((f, i) => (f.aggregation ? [] : [aliases[i]]));
      query = query.groupBy(dimensionAliases);
    }
  }

  if (quickStatFields.length === 0) {
    const mapRow = (row: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(headers.map((header, i) => [header, row[aliases[i]]]));
    return { headers, headerLabels, query, mapRow };
  }

  // Quick stats (percent of total, variation, running total, rank, moving average) are SQL
  // window functions computed over the result of the query above, not per-row scalars — so the
  // query is wrapped as a subquery and the window expressions are added on top of it, referencing
  // its own column aliases (col_0, col_1, ...) directly. Every source/order field a quick stat
  // needs is guaranteed to already be one of `fields` above (that's how the UI offers them — a
  // right-click on a field already placed in the view), so no new joins are needed here.
  let wrapped = knex(query.as('qs_base')).select(knex.raw('qs_base.*'));
  const statAliases = quickStatFields.map((_, i) => `stat_${i}`);
  quickStatFields.forEach((statField, i) => {
    const sourceAlias = findAlias(statField.sourceField);
    const orderAlias = statField.orderField ? findAlias(statField.orderField) : null;
    const { sql, bindings } = compileQuickStatSql(statField, sourceAlias, orderAlias);
    wrapped = wrapped.select(knex.raw(`${sql} as ??`, [...bindings, statAliases[i]]));
  });

  const finalHeaders = [...headers, ...quickStatFields.map((f) => `${QUICK_STAT_TABLE}.${f.id}`)];
  const finalHeaderLabels = [...headerLabels, ...quickStatFields.map((f) => f.label)];
  const finalAliases = [...aliases, ...statAliases];

  const mapRow = (row: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(finalHeaders.map((header, i) => [header, row[finalAliases[i]]]));

  return { headers: finalHeaders, headerLabels: finalHeaderLabels, query: wrapped, mapRow };
}

function connectsToJoined(relation: RelationRow, joined: Set<string>, candidate: string): boolean {
  return (joined.has(relation.source_table) && relation.target_table === candidate) || (joined.has(relation.target_table) && relation.source_table === candidate);
}

/** A table's own most recent import day at or before `atOrBefore` (or its most recent day ever, if `atOrBefore` is undefined). */
async function resolveLatestDate(knex: Knex, table: string, atOrBefore?: string): Promise<string | null> {
  const query = knex(table).max('date_ingestion as d');
  if (atOrBefore) query.where('date_ingestion', '<=', atOrBefore);
  const row = await query.first();
  const value = row?.d as string | Date | null | undefined;
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
