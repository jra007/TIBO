exports.up = function up(knex) {
  return knex.schema.createTable('user_group', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    table.primary(['user_id', 'group_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('user_group');
};
