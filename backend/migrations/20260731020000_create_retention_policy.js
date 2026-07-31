exports.up = function up(knex) {
  return knex.schema.createTable('retention_policy', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('data_type').notNullable().unique();
    table.integer('duration').notNullable();
    table.string('unit').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.string('last_modified_by');
    table.timestamp('last_modified_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('retention_policy');
};
