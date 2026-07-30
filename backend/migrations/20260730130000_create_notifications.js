exports.up = function up(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('recipient_user_id').notNullable();
    table.string('subject').notNullable();
    table.text('body').notNullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('notifications');
};
