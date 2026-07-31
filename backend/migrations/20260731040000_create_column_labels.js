exports.up = function up(knex) {
  return knex.schema.createTable('column_labels', (table) => {
    table.string('table_name').notNullable();
    table.string('column_name').notNullable();
    table.string('label').notNullable();
    table.string('updated_by');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['table_name', 'column_name']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('column_labels');
};
