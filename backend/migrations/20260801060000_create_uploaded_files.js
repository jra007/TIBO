// Generic file storage backing the appearance module's logo/favicon (and reusable for any future
// upload need) — disk storage, filename = this row's id, metadata kept here.
exports.up = function up(knex) {
  return knex.schema.createTable('uploaded_files', (table) => {
    table.uuid('id').primary();
    table.string('original_name').notNullable();
    table.string('mime_type').notNullable();
    table.integer('size').notNullable();
    table.string('uploaded_by').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('uploaded_files');
};
