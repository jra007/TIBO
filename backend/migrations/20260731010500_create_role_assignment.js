exports.up = async function up(knex) {
  await knex.schema.createTable('role_assignment', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.uuid('group_id').references('id').inTable('groups').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
  // A role assignment targets exactly one of group or user, never both, never neither.
  await knex.raw(
    `ALTER TABLE role_assignment ADD CONSTRAINT role_assignment_single_target_chk
     CHECK ((group_id IS NOT NULL)::int + (user_id IS NOT NULL)::int = 1)`,
  );
};

exports.down = function down(knex) {
  return knex.schema.dropTable('role_assignment');
};
