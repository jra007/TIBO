import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import { setLabel } from '../views/column-labels';
import { inferColumnTypes, normalizeColumnName, normalizeTableName, normalizeValue, parseSpreadsheet } from './parsing';

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
}

export interface JournalEntry {
  id: string;
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
  importedAt: Date;
}

const BATCH_SIZE = 500;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  async ingestFile(fileName: string, buffer: Buffer): Promise<IngestionResult> {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const tableName = normalizeTableName(fileName);

    // Content hash, not file name: a duplicate must be caught even if the file was renamed, and a
    // genuinely different file re-using the same name must not be blocked (see addendum's case 2/3).
    // Only compares against previously *successful* imports — a failed or already-rejected attempt
    // never stored any data, so there is nothing to actually be a duplicate of.
    const priorMatch = await this.knex('ingestion_journal').where({ file_hash: fileHash, status: 'success' }).orderBy('imported_at', 'desc').first();
    if (priorMatch) {
      const message = `Ce fichier a déjà été importé le ${new Date(priorMatch.imported_at).toLocaleString('fr-FR')}.`;
      const result: IngestionResult = { fileName, tableName, rowCount: 0, status: 'duplicate', errors: [message] };
      await this.writeJournalEntry(result, fileHash);
      return result;
    }

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

  /** Cosmetic display name for a column — doesn't touch the underlying data or schema. */
  async setColumnLabel(tableName: string, columnName: string, label: string, actorUserId: string): Promise<void> {
    await setLabel(this.knex, tableName, columnName, label, actorUserId);
  }

  /** Full ingestion history, not just the current session's upload result — was persisted but never actually readable. */
  async listJournal(): Promise<JournalEntry[]> {
    const rows = await this.knex('ingestion_journal').orderBy('imported_at', 'desc');
    return rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      tableName: row.table_name,
      rowCount: row.row_count,
      status: row.status,
      errors: row.errors,
      importedAt: row.imported_at,
    }));
  }

  /**
   * Deletes selected journal entries only — never touches the actual src_* tables. Each import
   * overwrites its target table wholesale (see loadIntoTable), so an older journal row for a
   * file re-imported since doesn't correspond to any live data anyway; this is purely history
   * hygiene (e.g. clearing duplicate entries from a file uploaded twice by mistake).
   * journal_ingestion carries a 5-year retention policy (spec 6bis) — this bypasses it the same
   * deliberate, audited way relation bulk-delete bypasses the rejected-relations retention.
   */
  async deleteJournalEntries(ids: string[], actorUserId: string): Promise<{ deletedCount: number }> {
    const deletedCount = await this.knex('ingestion_journal').whereIn('id', ids).delete();
    await this.auditService.record({ actorUserId, action: 'ingestion.journal.delete_entries', target: 'ingestion_journal', after: { ids, deletedCount } });
    return { deletedCount };
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
