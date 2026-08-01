exports.up = function up(knex) {
  return knex.schema.alterTable('views', (table) => {
    table.jsonb('quick_stat_fields').notNullable().defaultTo('[]');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('views', (table) => table.dropColumn('quick_stat_fields'));
};
