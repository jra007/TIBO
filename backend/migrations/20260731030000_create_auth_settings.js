exports.up = function up(knex) {
  return knex.schema.createTable('auth_settings', (table) => {
    table.string('id').primary().defaultTo('singleton');
    table.string('active_mode').notNullable().defaultTo('local');
    table.string('ldap_server_url');
    table.string('ldap_base_dn');
    table.jsonb('ldap_attribute_mapping').notNullable().defaultTo('{}');
    table.string('updated_by');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('auth_settings');
};
