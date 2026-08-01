// New permission introduced after the initial admin bootstrap — roles created before this
// migration (in particular the production admin role) would otherwise never see it without a
// manual grant. Any role that already holds settings:rbac:edit is by construction a full-admin
// role, so it's safe to grant settings:reset:execute to it here automatically.
exports.up = async function up(knex) {
  const adminRoles = await knex('role_permission').where({ permission: 'settings:rbac:edit' }).select('role_id');
  const rows = adminRoles.map(({ role_id }) => ({ role_id, permission: 'settings:reset:execute' }));
  if (rows.length > 0) await knex('role_permission').insert(rows).onConflict(['role_id', 'permission']).ignore();
};

exports.down = async function down(knex) {
  await knex('role_permission').where({ permission: 'settings:reset:execute' }).delete();
};
