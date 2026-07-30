exports.up = function up(knex) {
  return knex.schema.createTable('detected_relations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('source_table').notNullable();
    table.string('source_column').notNullable();
    table.string('target_table').notNullable();
    table.string('target_column').notNullable();
    table.float('confidence_score').notNullable();
    table.float('name_similarity').notNullable();
    table.boolean('type_compatible').notNullable();
    table.float('cardinality_score').notNullable();
    table.float('containment').notNullable();
    table.string('status').notNullable().defaultTo('proposed');
    table.string('validated_by');
    table.timestamp('validated_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['source_table', 'source_column', 'target_table', 'target_column']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTable('detected_relations');
};
