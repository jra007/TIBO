// Distinguishes LDAP-provisioned shadow accounts from real local accounts, so an LDAP login
// can never silently take over a username that already has a local password set.
exports.up = function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.string('auth_provider').notNullable().defaultTo('local');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('users', (table) => table.dropColumn('auth_provider'));
};
