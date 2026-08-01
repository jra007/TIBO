// Same rationale as the two earlier grant migrations for settings:reset:execute / ingestion:manage.
exports.up = async function up(knex) {
  const adminRoles = await knex('role_permission').where({ permission: 'settings:rbac:edit' }).select('role_id');
  const rows = adminRoles.map(({ role_id }) => ({ role_id, permission: 'settings:appearance:edit' }));
  if (rows.length > 0) await knex('role_permission').insert(rows).onConflict(['role_id', 'permission']).ignore();
};

exports.down = async function down(knex) {
  await knex('role_permission').where({ permission: 'settings:appearance:edit' }).delete();
};
