exports.up = function up(knex) {
  return knex.schema.alterTable('views', (table) => {
    table.jsonb('calculated_fields').notNullable().defaultTo('[]');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('views', (table) => table.dropColumn('calculated_fields'));
};
