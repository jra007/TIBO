import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { ProjectsService } from '../admin/settings/projects.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RbacService } from '../rbac/rbac.service';
import { setLabel } from '../views/column-labels';
import {
  detectMixedCurrencyColumns,
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

export type IngestionStatus =
  'success' | 'error' | 'duplicate' | 'pending_review';

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: IngestionStatus;
  errors: string[];
  cleaningReport: CleaningReport | null;
}

export interface JournalEntry {
  id: string;
  fileName: string;
  tableName: string;
  rowCount: number;
  status: IngestionStatus;
  errors: string[];
  importedAt: Date;
  cleaningReport: CleaningReport | null;
}

const BATCH_SIZE = 500;
const CLEANED_PREVIEW_ROW_LIMIT = 50;

/** The project choice made once for an entire upload batch (see IngestionController.upload) — only
 * actually applied the first time a given table is created (see loadIntoTable), never re-asked on
 * a daily re-import of the same file. */
export interface ProjectAssignment {
  projectId: string | null;
  isShared: boolean;
}

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
    private readonly rbacService: RbacService,
    private readonly notificationsService: NotificationsService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Grid preview for the assisted-correction UI, before anything is committed (nettoyage
   * addendum, section 3). If a data admin already validated this exact file name before, the
   * memorized rule is reapplied automatically and no review is needed — only a never-seen file
   * gets a grid back. `skippedSheets` (a multi-sheet Excel file only ever has its first sheet
   * read) is therefore only surfaced here for a never-seen file; a memorized-rule file skips
   * re-parsing the grid entirely, so it only learns about skipped sheets via the ingestion
   * journal's CleaningReport once the actual import runs (ingestFile → parseSpreadsheet always
   * computes it, regardless of this shortcut).
   */
  async previewFile(
    fileName: string,
    buffer: Buffer,
  ): Promise<{
    hasMemorizedRule: boolean;
    suggestedHeaderRowIndex: number;
    rows?: PreviewRow[];
    totalRows?: number;
    skippedSheets?: string[];
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
    const { rows, totalRows, suggestedHeaderRowIndex, skippedSheets } =
      previewGrid(buffer, fileName);
    return {
      hasMemorizedRule: false,
      suggestedHeaderRowIndex,
      rows,
      totalRows,
      skippedSheets,
    };
  }

  /**
   * The actual cleaned result a correction would produce (headers applied, columns/rows already
   * removed, values trimmed) — never touches the database. Distinct from previewFile's raw grid:
   * this is what the assisted-correction flow shows *after* a correction is picked, so a data
   * admin can see the real outcome before the import actually runs, not just the raw rows they
   * picked a header/exclusions from. Capped to CLEANED_PREVIEW_ROW_LIMIT rows — same reasoning as
   * previewGrid's head+tail cap, a large import's full cleaned table would be impractical to show.
   */
  previewCleanedFile(
    fileName: string,
    buffer: Buffer,
    correction?: CleaningCorrection,
  ): {
    headers: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    report: CleaningReport;
  } {
    const { rows, headers, report } = parseSpreadsheet(
      buffer,
      fileName,
      correction,
    );
    // Cheap enough to compute here too (unlike loadIntoTable, no table/schema work involved) —
    // lets a mixed-currency column surface in the pre-import preview, not just after the fact in
    // the journal.
    if (rows.length > 0) {
      const columnTypes = inferColumnTypes(rows, headers);
      report.mixedCurrencyColumns = detectMixedCurrencyColumns(
        rows,
        headers,
        columnTypes,
      );
    }
    return {
      headers,
      rows: rows.slice(0, CLEANED_PREVIEW_ROW_LIMIT),
      totalRows: rows.length,
      report,
    };
  }

  async ingestFile(
    fileName: string,
    buffer: Buffer,
    actorUserId: string,
    correction?: CleaningCorrection,
    projectAssignment?: ProjectAssignment,
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
      const { rows, report } = parseSpreadsheet(
        buffer,
        fileName,
        effectiveCorrection,
      );
      if (rows.length === 0)
        throw new Error('Fichier vide ou format non reconnu');

      // Anomaly guard (nettoyage addendum, section 4): only when *reapplying* a rule memorized
      // from a past import, never for a correction just validated by a human moments ago — that
      // one is already a considered decision, not a blind repeat of one. A rule reapplied on a
      // file that now deviates far from its own recent history (e.g. a much larger fraction of
      // rows would be excluded than usual) pauses here instead of executing silently.
      const isReappliedRule = !correction && effectiveCorrection !== undefined;
      if (isReappliedRule) {
        const anomaly = await this.detectCleaningAnomaly(fileName, report);
        if (anomaly) {
          const result: IngestionResult = {
            fileName,
            tableName,
            rowCount: 0,
            status: 'pending_review',
            errors: [anomaly],
            cleaningReport: report,
          };
          await this.writeJournalEntry(result, fileHash);
          await this.alertDataAdmins(fileName, anomaly);
          return result;
        }
      }

      const { rowCount, mixedCurrencyColumns } = await this.loadIntoTable(
        tableName,
        rows,
        projectAssignment,
      );
      const result: IngestionResult = {
        fileName,
        tableName,
        rowCount,
        status: 'success',
        errors: [],
        // Column typing (and therefore mixed-currency detection) only happens inside
        // loadIntoTable, after `report` was already built by parseSpreadsheet — merged in here so
        // it still ends up in the same journaled CleaningReport as every other cleanup signal.
        cleaningReport: { ...report, mixedCurrencyColumns },
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

  private static readonly ANOMALY_MULTIPLIER = 4;
  private static readonly MIN_HISTORY_FOR_ANOMALY_CHECK = 2;

  /**
   * Compares this import's exclusion ratio (trailing rows dropped ÷ total data rows) against the
   * last few successful imports of the same file. Returns a message if it's an outlier (more than
   * ANOMALY_MULTIPLIER times the recent average — the addendum suggests "3 to 5x", this picks the
   * middle), or null if there's nothing unusual (or not enough history yet to tell).
   */
  private async detectCleaningAnomaly(
    fileName: string,
    report: CleaningReport,
  ): Promise<string | null> {
    const currentTotal = report.keptRowCount + report.trailingRowsExcluded;
    if (currentTotal === 0 || report.trailingRowsExcluded === 0) return null;
    const currentRatio = report.trailingRowsExcluded / currentTotal;

    const priorEntries: { cleaning_report: CleaningReport | null }[] =
      await this.knex('ingestion_journal')
        .where({ file_name: fileName, status: 'success' })
        .whereNotNull('cleaning_report')
        .orderBy('imported_at', 'desc')
        .limit(5);

    const priorRatios = priorEntries
      .map((entry) => entry.cleaning_report)
      .filter(
        (priorReport): priorReport is CleaningReport =>
          priorReport !== null && typeof priorReport.keptRowCount === 'number',
      )
      .map((priorReport) => {
        const total =
          priorReport.keptRowCount + priorReport.trailingRowsExcluded;
        return total > 0 ? priorReport.trailingRowsExcluded / total : 0;
      });

    if (priorRatios.length < IngestionService.MIN_HISTORY_FOR_ANOMALY_CHECK)
      return null;

    const averageRatio =
      priorRatios.reduce((sum, ratio) => sum + ratio, 0) / priorRatios.length;
    if (averageRatio === 0) {
      return `Ce fichier n'excluait habituellement aucune ligne en fin de fichier ; ${report.trailingRowsExcluded} ligne(s) seraient exclues cette fois. Import mis en attente pour validation par un administrateur données.`;
    }
    if (currentRatio > averageRatio * IngestionService.ANOMALY_MULTIPLIER) {
      return `Le nettoyage exclurait ${(currentRatio * 100).toFixed(0)}% des lignes de ce fichier, contre ${(averageRatio * 100).toFixed(0)}% habituellement. Import mis en attente pour validation par un administrateur données.`;
    }
    return null;
  }

  private async alertDataAdmins(
    fileName: string,
    message: string,
  ): Promise<void> {
    const adminIds =
      await this.rbacService.listUsersWithPermission('ingestion:manage');
    for (const userId of adminIds) {
      await this.notificationsService.notify({
        recipientUserId: userId,
        subject: `Import en attente de validation : ${fileName}`,
        body: message,
      });
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
    rows: Record<string, unknown>[],
    projectAssignment?: ProjectAssignment,
  ): Promise<{ rowCount: number; mixedCurrencyColumns: string[] }> {
    const headers = Object.keys(rows[0]);
    const columnTypes = inferColumnTypes(rows, headers);
    const mixedCurrencyColumns = detectMixedCurrencyColumns(
      rows,
      headers,
      columnTypes,
    );
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
      // Recorded only at real table creation, never on a later re-import of the same file — a
      // project choice made once is remembered (ProjectsService.assignTable is insert-only), the
      // same "decide once" spirit as ingestion_cleaning_rules elsewhere in this file. Defaulting
      // to is_shared:true (visible everywhere) when nothing was supplied preserves the pre-project
      // behavior for any caller — API or otherwise — that doesn't pass a choice.
      await this.projectsService.assignTable(
        tableName,
        projectAssignment?.projectId ?? null,
        projectAssignment?.isShared ?? true,
      );
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

    return { rowCount: records.length, mixedCurrencyColumns };
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
