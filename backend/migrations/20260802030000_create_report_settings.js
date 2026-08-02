exports.up = function up(knex) {
  return knex.schema.createTable('report_settings', (table) => {
    table.string('id').primary().defaultTo('singleton');
    // Falls back to appearance_settings.title when null — most orgs want the same brand name
    // everywhere, but a report can legitimately need different wording (e.g. a legal entity name).
    table.string('header_title');
    table.string('header_subtitle');
    table.boolean('show_logo').notNullable().defaultTo(true);
    table.boolean('show_page_numbers').notNullable().defaultTo(true);
    table.boolean('show_export_date').notNullable().defaultTo(true);
    table.string('updated_by');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('report_settings');
};
