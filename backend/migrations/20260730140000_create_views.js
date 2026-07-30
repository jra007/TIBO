exports.up = function up(knex) {
  return knex.schema.createTable('views', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('owner_id').notNullable();
    table.string('name').notNullable();
    table.string('chart_type').notNullable();
    table.jsonb('shelves').notNullable();
    table.jsonb('tables_used').notNullable().defaultTo('[]');
    table.jsonb('relation_ids').notNullable().defaultTo('[]');
    table.string('visibility').notNullable().defaultTo('private');
    table.string('shared_with_group_id');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('views');
};
