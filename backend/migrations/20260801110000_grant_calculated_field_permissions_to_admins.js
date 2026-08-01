// Same rationale as the earlier grant migrations for settings:reset:execute / ingestion:manage /
// settings:appearance:edit: new permissions default to unassigned, so without this, existing
// admin roles would suddenly be unable to create or edit calculated fields they already own.
exports.up = async function up(knex) {
  const adminRoles = await knex('role_permission').where({ permission: 'settings:rbac:edit' }).select('role_id');
  const newPermissions = ['field:calculated:create', 'field:calculated:edit', 'field:calculated:share'];
  const rows = adminRoles.flatMap(({ role_id }) => newPermissions.map((permission) => ({ role_id, permission })));
  if (rows.length > 0) await knex('role_permission').insert(rows).onConflict(['role_id', 'permission']).ignore();
};

exports.down = async function down(knex) {
  await knex('role_permission').whereIn('permission', ['field:calculated:create', 'field:calculated:edit', 'field:calculated:share']).delete();
};
