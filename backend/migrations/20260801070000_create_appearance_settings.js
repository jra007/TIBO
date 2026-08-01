exports.up = function up(knex) {
  return knex.schema.createTable('appearance_settings', (table) => {
    table.string('id').primary().defaultTo('singleton');
    table.uuid('logo_file_id').references('id').inTable('uploaded_files').onDelete('SET NULL');
    table.uuid('favicon_file_id').references('id').inTable('uploaded_files').onDelete('SET NULL');
    table.string('title');
    table.string('primary_color'); // hex, e.g. #2a78d6 — button/link accent app-wide
    table.string('background_color'); // hex — page canvas background
    table.string('updated_by');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('appearance_settings');
};
