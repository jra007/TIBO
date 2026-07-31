exports.up = function up(knex) {
  return knex.schema.createTable('role_permission', (table) => {
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.string('permission').notNullable();
    table.primary(['role_id', 'permission']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('role_permission');
};
