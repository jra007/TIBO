exports.up = function up(knex) {
  return knex.schema.createTable('smtp_settings', (table) => {
    table.string('id').primary().defaultTo('singleton');
    table.string('server_url');
    table.integer('port');
    table.string('credentials_secret_ref');
    table.string('sender_address');
    table.string('updated_by');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('smtp_settings');
};
