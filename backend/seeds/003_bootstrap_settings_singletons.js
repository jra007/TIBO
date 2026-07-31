exports.seed = async function seed(knex) {
  const authRow = await knex('auth_settings').where({ id: 'singleton' }).first();
  if (!authRow) {
    await knex('auth_settings').insert({ id: 'singleton', active_mode: 'local' });
  }

  const smtpRow = await knex('smtp_settings').where({ id: 'singleton' }).first();
  if (!smtpRow) {
    await knex('smtp_settings').insert({ id: 'singleton' });
  }
};
