// Lets an owner reorder their own dashboards on the /dashboards list page — until now the only
// order was `created_at desc`, with no way to change it. Backfilled per-owner by current
// created_at order (oldest first) so existing dashboards keep their current relative order
// rather than all landing on the same value.
exports.up = async function up(knex) {
  await knex.schema.alterTable('dashboards', (table) => {
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.raw(`
    UPDATE dashboards
    SET sort_order = ranked.rank
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) - 1 AS rank
      FROM dashboards
    ) AS ranked
    WHERE dashboards.id = ranked.id
  `);
};

exports.down = function down(knex) {
  return knex.schema.alterTable('dashboards', (table) => {
    table.dropColumn('sort_order');
  });
};
