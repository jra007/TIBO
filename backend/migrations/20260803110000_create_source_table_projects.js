// Registry of which project (if any) each ingested src_* table belongs to. Nothing tracked this
// before — TIBO discovers src_* tables purely via information_schema, so this is the first
// app-level record of "which table is this". `table_name` is a plain string primary key rather
// than a foreign key into some catalog table: src_* tables are created dynamically outside
// Knex's own schema tracking, there's nothing else to reference.
//
// Backward compatibility: every table that already exists when this migration runs is backfilled
// with `is_shared = true` — none of them were ever scoped to a project before, so nothing already
// built (a saved view, a dashboard) should lose access to a field it already used. Only files
// imported after this ships get asked to pick a project.
exports.up = async function up(knex) {
  await knex.schema.createTable('source_table_projects', (table) => {
    table.string('table_name').primary();
    table.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
    table.boolean('is_shared').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  const { rows: tables } = await knex.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ESCAPE '\\'`,
  );
  for (const { table_name: tableName } of tables) {
    await knex('source_table_projects').insert({ table_name: tableName, project_id: null, is_shared: true }).onConflict('table_name').ignore();
  }
};

exports.down = function down(knex) {
  return knex.schema.dropTable('source_table_projects');
};
