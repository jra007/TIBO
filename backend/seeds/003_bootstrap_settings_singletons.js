exports.seed = async function seed(knex) {
  const authRow = await knex('auth_settings').where({ id: 'singleton' }).first();
  if (!authRow) {
    await knex('auth_settings').insert({ id: 'singleton' });
  }

  const smtpRow = await knex('smtp_settings').where({ id: 'singleton' }).first();
  if (!smtpRow) {
    await knex('smtp_settings').insert({ id: 'singleton' });
  }

  const appearanceRow = await knex('appearance_settings').where({ id: 'singleton' }).first();
  if (!appearanceRow) {
    await knex('appearance_settings').insert({ id: 'singleton' });
  }

  const reportRow = await knex('report_settings').where({ id: 'singleton' }).first();
  if (!reportRow) {
    await knex('report_settings').insert({ id: 'singleton' });
  }
};
