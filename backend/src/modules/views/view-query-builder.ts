import type { Knex } from 'knex';
import { getLabelsMap } from './column-labels';
import type { Aggregation, ShelfDefinition } from './views.service';

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

/**
 * Builds the query for "the underlying data of a view": the columns placed in
 * rows/columns/color/size, joined across tables via the relations pinned on the view at creation
 * time (ViewsService.pinRelationsForTablePairs). Fields with an `aggregation` set (numeric
 * measures, per spec 3.1.3) are summed/averaged/etc. and GROUP BY the remaining (dimension)
 * fields; if no field has an aggregation, this is a plain projection of raw rows — that's still
 * the common case for a 'table' chart type. The `filters` shelf has no stored values/operators
 * yet, so it's excluded here too.
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
): Promise<{
  headers: string[];
  headerLabels: string[];
  query: Knex.QueryBuilder;
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
}> {
  const fields = dedupeFields([...shelves.rows, ...shelves.columns, ...shelves.color, ...shelves.size]);
  if (fields.length === 0) throw new Error('Cette vue ne contient aucun champ à afficher');

  const tables = [...new Set(fields.map((f) => f.tableName))];
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

  const headers = fields.map((f) => `${f.tableName}.${f.columnName}`);
  const labelsMap = await getLabelsMap(knex, fields);
  const headerLabels = fields.map((f) => labelsMap.get(`${f.tableName}.${f.columnName}`) ?? f.columnName);
  const aliases = fields.map((_, i) => `col_${i}`);
  const dimensionFields = fields.filter((f) => !f.aggregation);
  const measureFields = fields.filter((f) => f.aggregation);

  if (measureFields.length === 0) {
    const selectExpr = fields.map((f, i) => knex.raw('?? as ??', [`${f.tableName}.${f.columnName}`, aliases[i]]));
    query = query.select(selectExpr);
  } else {
    const selectExpr = fields.map((f, i) =>
      f.aggregation
        ? knex.raw(`${SQL_AGGREGATE[f.aggregation]}(??) as ??`, [`${f.tableName}.${f.columnName}`, aliases[i]])
        : knex.raw('?? as ??', [`${f.tableName}.${f.columnName}`, aliases[i]]),
    );
    query = query.select(selectExpr);
    if (dimensionFields.length > 0) {
      query = query.groupBy(dimensionFields.map((f) => `${f.tableName}.${f.columnName}`));
    }
  }

  const mapRow = (row: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(headers.map((header, i) => [header, row[aliases[i]]]));

  return { headers, headerLabels, query, mapRow };
}

function connectsToJoined(relation: RelationRow, joined: Set<string>, candidate: string): boolean {
  return (joined.has(relation.source_table) && relation.target_table === candidate) || (joined.has(relation.target_table) && relation.source_table === candidate);
}
