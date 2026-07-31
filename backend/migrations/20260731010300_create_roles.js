exports.up = function up(knex) {
  return knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.string('description');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('roles');
};
