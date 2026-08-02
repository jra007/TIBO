const { randomBytes, scryptSync } = require('node:crypto');

// Mirrors backend/src/modules/rbac/permissions.ts — kept in sync manually since this seed
// runs as plain JS outside the TypeScript build.
const ALL_PERMISSIONS = [
  'view:read',
  'view:create',
  'view:share',
  'export:pdf',
  'export:excel',
  'relation:validate',
  'settings:access',
  'settings:retention:edit',
  'settings:rbac:edit',
  'settings:reset:execute',
  'ingestion:manage',
  'settings:appearance:edit',
  'field:calculated:create',
  'field:calculated:edit',
  'field:calculated:share',
  'settings:report:edit',
];

const ADMIN_USERNAME = 'admin';
const ADMIN_ROLE_NAME = 'Administrateur système';
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

exports.seed = async function seed(knex) {
  const existingAdmin = await knex('users').where({ username: ADMIN_USERNAME }).first();
  if (existingAdmin) return; // idempotent: already bootstrapped

  const adminPassword = process.env.TIBO_ADMIN_PASSWORD || 'changeme123';
  // eslint-disable-next-line no-console
  console.warn(
    `[seed] Bootstrapping local admin user "${ADMIN_USERNAME}" with ${
      process.env.TIBO_ADMIN_PASSWORD ? 'the password from TIBO_ADMIN_PASSWORD' : 'the default dev password "changeme123"'
    } — change it before any non-local deployment.`,
  );

  const [user] = await knex('users')
    .insert({ username: ADMIN_USERNAME, password_hash: hashPassword(adminPassword), status: 'active' })
    .returning('*');

  const [role] = await knex('roles').insert({ name: ADMIN_ROLE_NAME, description: 'Accès complet, assigné au bootstrap MVP' }).returning('*');

  await knex('role_permission').insert(ALL_PERMISSIONS.map((permission) => ({ role_id: role.id, permission })));
  await knex('role_assignment').insert({ role_id: role.id, user_id: user.id });
};
