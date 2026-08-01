exports.up = async function up(knex) {
  await knex.schema.alterTable('groups', (table) => {
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.alterTable('roles', (table) => {
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('groups', (table) => table.dropColumn('created_at'));
  await knex.schema.alterTable('roles', (table) => table.dropColumn('created_at'));
};
