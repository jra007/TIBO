// Moves every already-ingested source table (src_*) from "snapshot, overwritten on every
// re-import" to "append-only history" — see TIBO_addendum_doublons_et_dates.md. Existing rows
// predate this column entirely, so they're backfilled with the table's own most recent
// successful ingestion date (the closest true answer to "when was this row actually imported"
// available before this migration existed) rather than left NULL, which would break any future
// "as of date X" filter.
exports.up = async function up(knex) {
  const { rows: tables } = await knex.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ESCAPE '\\'`,
  );

  for (const { table_name: tableName } of tables) {
    const hasColumn = await knex.schema.hasColumn(tableName, 'date_ingestion');
    if (hasColumn) continue;

    await knex.schema.alterTable(tableName, (table) => {
      table.date('date_ingestion');
      table.boolean('is_obsolete').notNullable().defaultTo(false);
    });

    const lastImport = await knex('ingestion_journal').where({ table_name: tableName, status: 'success' }).orderBy('imported_at', 'desc').first();
    const backfillExpression = lastImport ? knex.raw('?::date', [lastImport.imported_at]) : knex.raw('CURRENT_DATE');
    await knex(tableName).update({ date_ingestion: backfillExpression });

    await knex.schema.alterTable(tableName, (table) => {
      table.date('date_ingestion').notNullable().alter();
    });
  }
};

exports.down = async function down(knex) {
  const { rows: tables } = await knex.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ESCAPE '\\'`,
  );

  for (const { table_name: tableName } of tables) {
    const hasColumn = await knex.schema.hasColumn(tableName, 'date_ingestion');
    if (!hasColumn) continue;
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('date_ingestion');
      table.dropColumn('is_obsolete');
    });
  }
};
