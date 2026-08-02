exports.up = function up(knex) {
  return knex.schema.alterTable('ingestion_journal', (table) => {
    table.jsonb('cleaning_report').notNullable().defaultTo('{}');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('ingestion_journal', (table) => table.dropColumn('cleaning_report'));
};
