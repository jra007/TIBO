exports.up = async function up(knex) {
  await knex.schema.alterTable('smtp_settings', (table) => {
    table.renameColumn('server_url', 'host');
    table.renameColumn('sender_address', 'from_address');
  });
  await knex.schema.alterTable('smtp_settings', (table) => {
    table.dropColumn('credentials_secret_ref');
    table.boolean('secure').notNullable().defaultTo(false);
    table.string('username');
    table.text('password'); // AES-256-GCM encrypted, see common/encryption.ts
    table.boolean('require_tls').notNullable().defaultTo(false);
    table.boolean('tls_reject_unauthorized').notNullable().defaultTo(true);
    table.integer('connect_timeout_ms');
    table.integer('greeting_timeout_ms');
    table.integer('socket_timeout_ms');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('smtp_settings', (table) => {
    table.dropColumn('secure');
    table.dropColumn('username');
    table.dropColumn('password');
    table.dropColumn('require_tls');
    table.dropColumn('tls_reject_unauthorized');
    table.dropColumn('connect_timeout_ms');
    table.dropColumn('greeting_timeout_ms');
    table.dropColumn('socket_timeout_ms');
    table.string('credentials_secret_ref');
  });
  await knex.schema.alterTable('smtp_settings', (table) => {
    table.renameColumn('host', 'server_url');
    table.renameColumn('from_address', 'sender_address');
  });
};
