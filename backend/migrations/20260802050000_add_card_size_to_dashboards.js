// A dashboard's own width on the /dashboards list page (Petit/Moyen/Grand — 1/2/3 of a fixed
// 3-column grid), distinct from `layout` (which sizes each view TILE inside the dashboard's own
// detail page). Conflating the two in one jsonb blob would mix two unrelated concepts under
// different keys of the same map — a genuine column is clearer.
exports.up = function up(knex) {
  return knex.schema.alterTable('dashboards', (table) => {
    table.string('card_size').notNullable().defaultTo('medium');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('dashboards', (table) => {
    table.dropColumn('card_size');
  });
};
