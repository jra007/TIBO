exports.up = async function up(knex) {
  await knex.schema.alterTable('auth_settings', (table) => {
    table.renameColumn('ldap_server_url', 'ldap_url');
  });
  await knex.schema.alterTable('auth_settings', (table) => {
    table.dropColumn('active_mode'); // replaced by ldap_enabled — local login is always available, LDAP is an add-on toggle, not a mutually-exclusive mode
    table.dropColumn('ldap_attribute_mapping'); // replaced by an explicit ldap_username_attribute column below
    table.boolean('ldap_enabled').notNullable().defaultTo(false);
    table.string('ldap_bind_dn');
    table.text('ldap_bind_password'); // AES-256-GCM encrypted, see common/encryption.ts
    table.string('ldap_search_filter'); // must contain the literal "{{username}}"
    table.string('ldap_username_attribute').notNullable().defaultTo('uid');
    table.boolean('ldap_tls_reject_unauthorized').notNullable().defaultTo(true);
    table.integer('ldap_connect_timeout_ms');
    table.integer('ldap_timeout_ms');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('auth_settings', (table) => {
    table.dropColumn('ldap_enabled');
    table.dropColumn('ldap_bind_dn');
    table.dropColumn('ldap_bind_password');
    table.dropColumn('ldap_search_filter');
    table.dropColumn('ldap_username_attribute');
    table.dropColumn('ldap_tls_reject_unauthorized');
    table.dropColumn('ldap_connect_timeout_ms');
    table.dropColumn('ldap_timeout_ms');
    table.string('active_mode').notNullable().defaultTo('local');
    table.jsonb('ldap_attribute_mapping').notNullable().defaultTo('{}');
  });
  await knex.schema.alterTable('auth_settings', (table) => {
    table.renameColumn('ldap_url', 'ldap_server_url');
  });
};
