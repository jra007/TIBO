import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { inferColumnTypes, normalizeColumnName, normalizeTableName, normalizeValue, parseSpreadsheet } from './parsing';

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error';
  errors: string[];
}

const BATCH_SIZE = 500;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async ingestFile(fileName: string, buffer: Buffer): Promise<IngestionResult> {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const tableName = normalizeTableName(fileName);

    try {
      const rowCount = await this.loadIntoTable(tableName, buffer);
      const result: IngestionResult = { fileName, tableName, rowCount, status: 'success', errors: [] };
      await this.writeJournalEntry(result, fileHash);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion failed for ${fileName}: ${message}`);
      const result: IngestionResult = { fileName, tableName, rowCount: 0, status: 'error', errors: [message] };
      await this.writeJournalEntry(result, fileHash);
      return result;
    }
  }

  private async loadIntoTable(tableName: string, buffer: Buffer): Promise<number> {
    const rows = parseSpreadsheet(buffer);
    if (rows.length === 0) throw new Error('Fichier vide ou format non reconnu');

    const headers = Object.keys(rows[0]);
    const columnTypes = inferColumnTypes(rows, headers);
    const columns = headers.map((header, index) => ({
      source: header,
      name: normalizeColumnName(header, index),
      type: columnTypes[header],
    }));

    await this.knex.schema.dropTableIfExists(tableName);
    await this.knex.schema.createTable(tableName, (table) => {
      table.increments('id').primary();
      for (const column of columns) {
        switch (column.type) {
          case 'numeric':
            table.double(column.name);
            break;
          case 'date':
            table.timestamp(column.name, { useTz: true });
            break;
          case 'boolean':
            table.boolean(column.name);
            break;
          default:
            table.text(column.name);
        }
      }
    });

    const records = rows.map((row) => {
      const record: Record<string, unknown> = {};
      for (const column of columns) record[column.name] = normalizeValue(row[column.source], column.type);
      return record;
    });

    if (records.length > 0) await this.knex.batchInsert(tableName, records, BATCH_SIZE);
    return records.length;
  }

  private async writeJournalEntry(result: IngestionResult, fileHash: string): Promise<void> {
    await this.knex('ingestion_journal').insert({
      file_name: result.fileName,
      table_name: result.tableName,
      row_count: result.rowCount,
      status: result.status,
      errors: JSON.stringify(result.errors),
      file_hash: fileHash,
    });
  }
}
