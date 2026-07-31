import type { Knex } from 'knex';

interface FieldRef {
  tableName: string;
  columnName: string;
}

interface ShelfDefinition {
  rows: FieldRef[];
  columns: FieldRef[];
  color: FieldRef[];
  size: FieldRef[];
  filters: FieldRef[];
}

interface RelationRow {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

function dedupeFields(fields: FieldRef[]): FieldRef[] {
  const seen = new Set<string>();
  const result: FieldRef[] = [];
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
 * Builds the query for "the underlying data of a view": a plain projection of the columns
 * placed in rows/columns/color/size, joined across tables via the relations pinned on the view
 * at creation time (ViewsService.pinRelationsForTablePairs). No aggregation yet — shelves don't
 * carry a per-field aggregation config, so this exports raw rows, not summed/averaged measures.
 * The `filters` shelf has no stored values/operators yet either, so it's excluded here too.
 */
export async function buildViewDataQuery(
  knex: Knex,
  shelves: ShelfDefinition,
  relationIds: string[],
): Promise<{ headers: string[]; query: Knex.QueryBuilder }> {
  const fields = dedupeFields([...shelves.rows, ...shelves.columns, ...shelves.color, ...shelves.size]);
  if (fields.length === 0) throw new Error('Cette vue ne contient aucun champ à exporter');

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
  const selectMap = Object.fromEntries(fields.map((f) => [`${f.tableName}.${f.columnName}`, `${f.tableName}.${f.columnName}`]));
  query = query.select(selectMap);

  return { headers, query };
}

function connectsToJoined(relation: RelationRow, joined: Set<string>, candidate: string): boolean {
  return (joined.has(relation.source_table) && relation.target_table === candidate) || (joined.has(relation.target_table) && relation.source_table === candidate);
}
