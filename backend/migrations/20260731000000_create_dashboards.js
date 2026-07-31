exports.up = function up(knex) {
  return knex.schema.createTable('dashboards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('owner_id').notNullable();
    table.string('name').notNullable();
    table.jsonb('view_ids').notNullable().defaultTo('[]');
    table.jsonb('layout').notNullable().defaultTo('{}');
    table.string('visibility').notNullable().defaultTo('private');
    table.string('shared_with_group_id');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('dashboards');
};
