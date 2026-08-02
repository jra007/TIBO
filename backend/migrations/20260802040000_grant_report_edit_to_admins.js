// Same rationale as the earlier grant migrations (settings:appearance:edit etc.): a brand-new
// permission defaults to unassigned, so without this, existing admin roles would suddenly be
// unable to customize the report header they could previously only get as a fixed default.
exports.up = async function up(knex) {
  const adminRoles = await knex('role_permission').where({ permission: 'settings:rbac:edit' }).select('role_id');
  const rows = adminRoles.map(({ role_id }) => ({ role_id, permission: 'settings:report:edit' }));
  if (rows.length > 0) await knex('role_permission').insert(rows).onConflict(['role_id', 'permission']).ignore();
};

exports.down = async function down(knex) {
  await knex('role_permission').where({ permission: 'settings:report:edit' }).delete();
};
