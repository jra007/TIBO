exports.up = function up(knex) {
  return knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('actor_user_id').notNullable();
    table.string('action').notNullable();
    table.string('target').notNullable();
    table.jsonb('before');
    table.jsonb('after');
    table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('audit_log');
};
