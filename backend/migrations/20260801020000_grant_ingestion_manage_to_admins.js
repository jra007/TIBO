// Same rationale as 20260801000000_grant_reset_permission_to_admins.js: a role created before
// this permission existed (in particular the production admin role) needs it granted explicitly.
exports.up = async function up(knex) {
  const adminRoles = await knex('role_permission').where({ permission: 'settings:rbac:edit' }).select('role_id');
  const rows = adminRoles.map(({ role_id }) => ({ role_id, permission: 'ingestion:manage' }));
  if (rows.length > 0) await knex('role_permission').insert(rows).onConflict(['role_id', 'permission']).ignore();
};

exports.down = async function down(knex) {
  await knex('role_permission').where({ permission: 'ingestion:manage' }).delete();
};
