// A cleanup correction validated once by a data admin (real header row, excluded rows/columns) —
// keyed by exact file name (addendum's "points à trancher" #2: simpler and more predictable than a
// looser structural signature) and reapplied automatically on every subsequent import of that same
// file, without showing the preview grid again. See TIBO_addendum_nettoyage_fichiers.md section 3.
exports.up = function up(knex) {
  return knex.schema.createTable('ingestion_cleaning_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('file_name').notNullable().unique();
    table.integer('header_row_index').notNullable();
    // Count, not absolute row indexes: a recurring daily export's row count varies with data
    // volume, so "the last row" (a trailing total row) sits at a different absolute position each
    // day. A count of rows to drop from the very end of the file survives that variation; an
    // absolute index would silently start excluding real data instead once the row count changes.
    table.integer('trailing_rows_to_exclude').notNullable().defaultTo(0);
    table.jsonb('excluded_column_indexes').notNullable().defaultTo('[]');
    table.string('created_by').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('ingestion_cleaning_rules');
};
