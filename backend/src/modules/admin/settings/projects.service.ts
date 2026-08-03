import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  created_at: Date;
}

export interface SourceTableAssignment {
  tableName: string;
  projectId: string | null;
  isShared: boolean;
}

interface SourceTableAssignmentRow {
  table_name: string;
  project_id: string | null;
  is_shared: boolean;
}

function toDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  };
}

function assignmentToDomain(
  row: SourceTableAssignmentRow,
): SourceTableAssignment {
  return {
    tableName: row.table_name,
    projectId: row.project_id,
    isShared: row.is_shared,
  };
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(name: string, description: string): Promise<Project> {
    const [row]: ProjectRow[] = await this.knex('projects')
      .insert({ name, description })
      .returning('*');
    return toDomain(row);
  }

  async list(): Promise<Project[]> {
    const rows: ProjectRow[] = await this.knex('projects')
      .select('*')
      .orderBy('name');
    return rows.map(toDomain);
  }

  /**
   * Records which project (if any) an ingested table belongs to — insert-only via
   * onConflict().ignore(), so a later re-import of the same file (loadIntoTable only calls this
   * the first time a table is created) never silently overwrites a decision a human already made,
   * the same "decide once, remember it" spirit as ingestion_cleaning_rules.
   */
  async assignTable(
    tableName: string,
    projectId: string | null,
    isShared: boolean,
  ): Promise<void> {
    await this.knex('source_table_projects')
      .insert({
        table_name: tableName,
        project_id: projectId,
        is_shared: isShared,
      })
      .onConflict('table_name')
      .ignore();
  }

  async getAssignment(
    tableName: string,
  ): Promise<SourceTableAssignment | null> {
    const row: SourceTableAssignmentRow | undefined = await this.knex(
      'source_table_projects',
    )
      .where({ table_name: tableName })
      .first();
    return row ? assignmentToDomain(row) : null;
  }
}
