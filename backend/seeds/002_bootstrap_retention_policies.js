// Tightened working values from spec section 6bis — explicitly "à faire valider par le DPO/
// juridique avant mise en production", not final obligations. "Données consolidées en base
// relationnelle" is deliberately NOT seeded here: the spec explicitly says not to fix that
// duration arbitrarily before the applicable regulator's legal minimum is confirmed.
const DEFAULT_POLICIES = [
  { data_type: 'fichier_source_brut', duration: 7, unit: 'days' },
  { data_type: 'journal_ingestion', duration: 5, unit: 'years' },
  { data_type: 'journal_acces_export', duration: 5, unit: 'years' },
  { data_type: 'relations_rejetees', duration: 12, unit: 'months' },
  { data_type: 'exports_temporaires', duration: 1, unit: 'hours' },
  { data_type: 'cles_chiffrement', duration: 90, unit: 'days' },
];

exports.seed = async function seed(knex) {
  const existing = await knex('retention_policy').first();
  if (existing) return; // idempotent

  await knex('retention_policy').insert(DEFAULT_POLICIES.map((policy) => ({ ...policy, status: 'active' })));
};
