import type { Knex } from 'knex';

interface FieldKey {
  tableName: string;
  columnName: string;
}

/** Map keyed "table.column" -> custom label, only for fields that have one set. */
export async function getLabelsMap(knex: Knex, fields: FieldKey[]): Promise<Map<string, string>> {
  if (fields.length === 0) return new Map();
  const rows = await knex('column_labels').where((builder) => {
    for (const field of fields) {
      builder.orWhere({ table_name: field.tableName, column_name: field.columnName });
    }
  });
  return new Map(rows.map((row) => [`${row.table_name}.${row.column_name}`, row.label]));
}

/** Map keyed by bare column name -> label, for all labelled columns of a single table. */
export async function getLabelsForTable(knex: Knex, tableName: string): Promise<Map<string, string>> {
  const rows = await knex('column_labels').where({ table_name: tableName });
  return new Map(rows.map((row) => [row.column_name, row.label]));
}

export async function setLabel(knex: Knex, tableName: string, columnName: string, label: string, actorUserId: string): Promise<void> {
  await knex('column_labels')
    .insert({ table_name: tableName, column_name: columnName, label, updated_by: actorUserId })
    .onConflict(['table_name', 'column_name'])
    .merge({ label, updated_by: actorUserId, updated_at: new Date() });
}
