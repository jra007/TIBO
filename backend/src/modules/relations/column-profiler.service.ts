import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { getLabelsForTable } from '../views/column-labels';
import type { ColumnType } from '../ingestion/ingestion.service';

export interface ColumnProfile {
  table: string;
  column: string;
  dtype: ColumnType;
  row_count: number;
  unique_count: number;
  sample_values: string[];
}

const SAMPLE_LIMIT = 50;

function mapPgType(pgType: string): ColumnType {
  if (
    pgType.includes('double') ||
    pgType.includes('numeric') ||
    pgType.includes('int')
  )
    return 'numeric';
  if (pgType.includes('timestamp') || pgType.includes('date')) return 'date';
  if (pgType === 'boolean') return 'boolean';
  return 'text';
}

@Injectable()
export class ColumnProfilerService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /**
   * All tables created by the ingestion pipeline, i.e. one per imported source file. With
   * `projectId`, narrowed to that project's own tables plus any table marked `is_shared` (see
   * source_table_projects, populated by IngestionService.loadIntoTable at first table creation).
   * A table with no registry row at all — shouldn't happen once the Phase 1 migration's backfill
   * has run, but not something to bet correctness on — fails open (stays visible) rather than
   * silently disappearing from every project's field picker.
   */
  async listSourceTables(projectId?: string): Promise<string[]> {
    const { rows } = await this.knex.raw(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ORDER BY table_name`,
    );
    const tableNames: string[] = rows.map(
      (row: { table_name: string }) => row.table_name,
    );
    if (!projectId) return tableNames;

    const assignments: {
      table_name: string;
      project_id: string | null;
      is_shared: boolean;
    }[] = await this.knex('source_table_projects').whereIn(
      'table_name',
      tableNames,
    );
    const assigned = new Set(assignments.map((a) => a.table_name));
    const visible = new Set(
      assignments
        .filter((a) => a.is_shared || a.project_id === projectId)
        .map((a) => a.table_name),
    );
    return tableNames.filter(
      (name) => !assigned.has(name) || visible.has(name),
    );
  }

  /** Lightweight table+column listing (no row counts/samples) for UI field pickers. */
  async listTableSchemas(projectId?: string): Promise<
    {
      tableName: string;
      columns: {
        columnName: string;
        dtype: ColumnType;
        label: string | null;
      }[];
    }[]
  > {
    const tableNames = await this.listSourceTables(projectId);
    const result: {
      tableName: string;
      columns: {
        columnName: string;
        dtype: ColumnType;
        label: string | null;
      }[];
    }[] = [];
    for (const tableName of tableNames) {
      const { rows: columns } = await this.knex.raw(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? AND column_name NOT IN ('id', 'is_obsolete')
         ORDER BY ordinal_position`,
        [tableName],
      );
      const labels = await getLabelsForTable(this.knex, tableName);
      result.push({
        tableName,
        columns: (columns as { column_name: string; data_type: string }[]).map(
          (column) => ({
            columnName: column.column_name,
            dtype: mapPgType(column.data_type),
            label: labels.get(column.column_name) ?? null,
          }),
        ),
      });
    }
    return result;
  }

  async profileTables(tableNames: string[]): Promise<ColumnProfile[]> {
    const profiles: ColumnProfile[] = [];
    for (const tableName of tableNames) {
      const { rows: columns } = await this.knex.raw(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? AND column_name NOT IN ('id', 'is_obsolete')
         ORDER BY ordinal_position`,
        [tableName],
      );

      for (const column of columns as {
        column_name: string;
        data_type: string;
      }[]) {
        profiles.push(
          await this.profileColumn(
            tableName,
            column.column_name,
            column.data_type,
          ),
        );
      }
    }
    return profiles;
  }

  private async profileColumn(
    tableName: string,
    columnName: string,
    pgType: string,
  ): Promise<ColumnProfile> {
    const {
      rows: [counts],
    } = await this.knex.raw(
      `SELECT COUNT(*) AS row_count, COUNT(DISTINCT ??) AS unique_count FROM ??`,
      [columnName, tableName],
    );

    const { rows: sampleRows } = await this.knex.raw(
      `SELECT DISTINCT ?? AS val FROM ?? WHERE ?? IS NOT NULL LIMIT ${SAMPLE_LIMIT}`,
      [columnName, tableName, columnName],
    );

    return {
      table: tableName,
      column: columnName,
      dtype: mapPgType(pgType),
      row_count: Number(counts.row_count),
      unique_count: Number(counts.unique_count),
      sample_values: sampleRows.map((row: { val: unknown }) => String(row.val)),
    };
  }
}
