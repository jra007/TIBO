exports.up = function up(knex) {
  return knex.schema.createTable('ingestion_journal', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('file_name').notNullable();
    table.string('table_name').notNullable();
    table.integer('row_count').notNullable().defaultTo(0);
    table.string('status').notNullable();
    table.jsonb('errors').notNullable().defaultTo('[]');
    table.string('file_hash').notNullable();
    table.timestamp('imported_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('ingestion_journal');
};
