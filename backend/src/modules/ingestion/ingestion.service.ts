import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import { setLabel } from '../views/column-labels';
import {
  inferColumnTypes,
  normalizeColumnName,
  normalizeTableName,
  normalizeValue,
  parseSpreadsheet,
  previewGrid,
  type CleaningCorrection,
  type CleaningReport,
  type PreviewRow,
} from './parsing';

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
  cleaningReport: CleaningReport | null;
}

export interface JournalEntry {
  id: string;
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error' | 'duplicate';
  errors: string[];
  importedAt: Date;
  cleaningReport: CleaningReport | null;
}

const BATCH_SIZE = 500;

function addColumn(
  table: Knex.CreateTableBuilder,
  column: { name: string; type: ColumnType },
): void {
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

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Grid preview for the assisted-correction UI, before anything is committed (nettoyage
   * addendum, section 3). If a data admin already validated this exact file name before, the
   * memorized rule is reapplied automatically and no review is needed — only a never-seen file
   * gets a grid back.
   */
  async previewFile(
    fileName: string,
    buffer: Buffer,
  ): Promise<{
    hasMemorizedRule: boolean;
    suggestedHeaderRowIndex: number;
    rows?: PreviewRow[];
    totalRows?: number;
  }> {
    const existingRule = await this.knex('ingestion_cleaning_rules')
      .where({ file_name: fileName })
      .first();
    if (existingRule) {
      return {
        hasMemorizedRule: true,
        suggestedHeaderRowIndex: existingRule.header_row_index,
      };
    }
    const { rows, totalRows, suggestedHeaderRowIndex } = previewGrid(
      buffer,
      fileName,
    );
    return {
      hasMemorizedRule: false,
      suggestedHeaderRowIndex,
      rows,
      totalRows,
    };
  }

  async ingestFile(
    fileName: string,
    buffer: Buffer,
    actorUserId: string,
    correction?: CleaningCorrection,
  ): Promise<IngestionResult> {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const tableName = normalizeTableName(fileName);

    // Content hash, not file name: a duplicate must be caught even if the file was renamed, and a
    // genuinely different file re-using the same name must not be blocked (see addendum's case 2/3).
    // Only compares against previously *successful* imports — a failed or already-rejected attempt
    // never stored any data, so there is nothing to actually be a duplicate of.
    const priorMatch = await this.knex('ingestion_journal')
      .where({ file_hash: fileHash, status: 'success' })
      .orderBy('imported_at', 'desc')
      .first();
    if (priorMatch) {
      const message = `Ce fichier a déjà été importé le ${new Date(priorMatch.imported_at).toLocaleString('fr-FR')}.`;
      const result: IngestionResult = {
        fileName,
        tableName,
        rowCount: 0,
        status: 'duplicate',
        errors: [message],
        cleaningReport: null,
      };
      await this.writeJournalEntry(result, fileHash);
      return result;
    }

    // A correction submitted with this upload means the user just reviewed and validated the
    // file's structure in the preview grid — memorize it so future imports of the same file name
    // skip the preview and reapply it automatically. Otherwise, look up whichever rule (if any)
    // was memorized previously.
    let effectiveCorrection = correction;
    if (correction) {
      await this.knex('ingestion_cleaning_rules')
        .insert({
          file_name: fileName,
          header_row_index: correction.headerRowIndex,
          trailing_rows_to_exclude: correction.trailingRowsToExclude,
          excluded_column_indexes: JSON.stringify(
            correction.excludedColumnIndexes,
          ),
          created_by: actorUserId,
        })
        .onConflict('file_name')
        .merge({
          header_row_index: correction.headerRowIndex,
          trailing_rows_to_exclude: correction.trailingRowsToExclude,
          excluded_column_indexes: JSON.stringify(
            correction.excludedColumnIndexes,
          ),
          updated_at: new Date(),
        });
    } else {
      const existingRule = await this.knex('ingestion_cleaning_rules')
        .where({ file_name: fileName })
        .first();
      if (existingRule) {
        effectiveCorrection = {
          headerRowIndex: existingRule.header_row_index,
          trailingRowsToExclude: existingRule.trailing_rows_to_exclude,
          excludedColumnIndexes: existingRule.excluded_column_indexes,
        };
      }
    }

    try {
      const { rowCount, report } = await this.loadIntoTable(
        tableName,
        buffer,
        fileName,
        effectiveCorrection,
      );
      const result: IngestionResult = {
        fileName,
        tableName,
        rowCount,
        status: 'success',
        errors: [],
        cleaningReport: report,
      };
      await this.writeJournalEntry(result, fileHash);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion failed for ${fileName}: ${message}`);
      const result: IngestionResult = {
        fileName,
        tableName,
        rowCount: 0,
        status: 'error',
        errors: [message],
        cleaningReport: null,
      };
      await this.writeJournalEntry(result, fileHash);
      return result;
    }
  }

  /**
   * Append-only: an existing table is never dropped or overwritten (see
   * TIBO_addendum_doublons_et_dates.md). Every row carries `date_ingestion` (the UTC calendar day
   * of its import batch — this app runs UTC throughout, Postgres session timezone is Etc/UTC, so
   * that's the one consistent reference rather than an assumed business timezone) and
   * `is_obsolete`. A second successful import of the *same file* on the *same* UTC day is a
   * same-day correction: that day's still-current rows are marked obsolete (never deleted) and
   * the new rows take their place; a later day is a plain append that never touches prior rows.
   */
  private async loadIntoTable(
    tableName: string,
    buffer: Buffer,
    fileName: string,
    correction?: CleaningCorrection,
  ): Promise<{ rowCount: number; report: CleaningReport }> {
    const { rows, report } = parseSpreadsheet(buffer, fileName, correction);
    if (rows.length === 0)
      throw new Error('Fichier vide ou format non reconnu');

    const headers = Object.keys(rows[0]);
    const columnTypes = inferColumnTypes(rows, headers);
    const columns = headers.map((header, index) => ({
      source: header,
      name: normalizeColumnName(header, index),
      type: columnTypes[header],
    }));

    const tableExists = await this.knex.schema.hasTable(tableName);

    if (!tableExists) {
      await this.knex.schema.createTable(tableName, (table) => {
        table.increments('id').primary();
        table.date('date_ingestion').notNullable();
        table.boolean('is_obsolete').notNullable().defaultTo(false);
        for (const column of columns) addColumn(table, column);
      });
    } else {
      // Additive-only schema reconciliation: a column present in this import but not yet in the
      // table gets added. A column type change or removal isn't handled — rare for a recurring
      // daily export, and safely reconciling it needs a real migration, not a per-upload guess.
      const existingColumns = await this.knex(tableName).columnInfo();
      for (const column of columns) {
        if (!existingColumns[column.name]) {
          await this.knex.schema.alterTable(tableName, (table) =>
            addColumn(table, column),
          );
        }
      }
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    const priorToday = tableExists
      ? await this.knex('ingestion_journal')
          .where({ table_name: tableName, status: 'success' })
          .andWhereRaw('imported_at::date = ?::date', [todayUtc])
          .first()
      : undefined;

    const records = rows.map((row) => {
      const record: Record<string, unknown> = {
        date_ingestion: todayUtc,
        is_obsolete: false,
      };
      for (const column of columns)
        record[column.name] = normalizeValue(row[column.source], column.type);
      return record;
    });

    await this.knex.transaction(async (trx) => {
      if (priorToday) {
        await trx(tableName)
          .where({ date_ingestion: todayUtc, is_obsolete: false })
          .update({ is_obsolete: true });
      }
      if (records.length > 0)
        await this.knex
          .batchInsert(tableName, records, BATCH_SIZE)
          .transacting(trx);
    });

    return { rowCount: records.length, report };
  }

  /**
   * The most recent UTC calendar day across every source table's ingestion history — the global
   * date selector's default value (effectively "today" whenever today's import has already run,
   * falling back gracefully to whatever the last real import day was otherwise).
   */
  async getLatestIngestionDate(): Promise<string | null> {
    const { rows: tables } = await this.knex.raw(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ESCAPE '\\'`,
    );
    let latest: string | null = null;
    for (const { table_name: tableName } of tables as {
      table_name: string;
    }[]) {
      const row = await this.knex(tableName).max('date_ingestion as d').first();
      const value = row?.d
        ? new Date(row.d as string).toISOString().slice(0, 10)
        : null;
      if (value && (!latest || value > latest)) latest = value;
    }
    return latest;
  }

  /** Cosmetic display name for a column — doesn't touch the underlying data or schema. */
  async setColumnLabel(
    tableName: string,
    columnName: string,
    label: string,
    actorUserId: string,
  ): Promise<void> {
    await setLabel(this.knex, tableName, columnName, label, actorUserId);
  }

  /** Full ingestion history, not just the current session's upload result — was persisted but never actually readable. */
  async listJournal(): Promise<JournalEntry[]> {
    const rows = await this.knex('ingestion_journal').orderBy(
      'imported_at',
      'desc',
    );
    return rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      tableName: row.table_name,
      rowCount: row.row_count,
      status: row.status,
      errors: row.errors,
      importedAt: row.imported_at,
      cleaningReport:
        row.cleaning_report && Object.keys(row.cleaning_report).length > 0
          ? row.cleaning_report
          : null,
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
  async deleteJournalEntries(
    ids: string[],
    actorUserId: string,
  ): Promise<{ deletedCount: number }> {
    const deletedCount = await this.knex('ingestion_journal')
      .whereIn('id', ids)
      .delete();
    await this.auditService.record({
      actorUserId,
      action: 'ingestion.journal.delete_entries',
      target: 'ingestion_journal',
      after: { ids, deletedCount },
    });
    return { deletedCount };
  }

  private async writeJournalEntry(
    result: IngestionResult,
    fileHash: string,
  ): Promise<void> {
    await this.knex('ingestion_journal').insert({
      file_name: result.fileName,
      table_name: result.tableName,
      row_count: result.rowCount,
      status: result.status,
      errors: JSON.stringify(result.errors),
      file_hash: fileHash,
      cleaning_report: JSON.stringify(result.cleaningReport ?? {}),
    });
  }
}
