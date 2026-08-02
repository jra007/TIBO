import * as XLSX from 'xlsx';
import type { ColumnType } from './ingestion.service';

/** What automatic cleanup did to a file, for the ingestion journal — see TIBO_addendum_nettoyage_fichiers.md section 2. */
export interface CleaningReport {
  encoding: 'utf-8' | 'latin1';
  /** 0 = the header was already on the first row; >0 = that many leading rows (title/free text) were skipped. */
  headerRowIndex: number;
  droppedBlankColumns: string[];
}

function isCsvFile(fileName: string): boolean {
  return /\.csv$/i.test(fileName);
}

/**
 * XLSX/XLS are binary formats with their own internal (UTF-8) text encoding — no ambiguity. A CSV
 * is plain text of unknown encoding: European banking exports are frequently Windows-1252/Latin-1,
 * not UTF-8, and decoding those as UTF-8 corrupts every accented character. `TextDecoder`'s
 * `fatal: true` throws on invalid UTF-8 byte sequences, which is what tells the two apart.
 */
function decodeCsvBuffer(buffer: Buffer): {
  content: string;
  encoding: 'utf-8' | 'latin1';
} {
  try {
    return {
      content: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      encoding: 'utf-8',
    };
  } catch {
    return { content: buffer.toString('latin1'), encoding: 'latin1' };
  }
}

function nonEmptyCount(row: unknown[]): number {
  return row.filter(
    (cell) => cell !== null && cell !== undefined && cell !== '',
  ).length;
}

/**
 * Finds the real header row when one or more free-text title rows precede it (e.g. a report title
 * spanning the sheet before the actual table starts). Approximates the addendum's heuristic
 * ("première ligne suivie de données au type cohérent") as "the first row with at least 2
 * non-empty cells whose count matches the row right below it" — a title row has far fewer
 * non-empty cells than the header+data rows that follow it. Falls back to row 0 (no title rows;
 * or a single-column file, where this heuristic can't distinguish anything).
 */
function detectHeaderRowIndex(rows: unknown[][]): number {
  const searchLimit = Math.min(rows.length - 1, 10);
  for (let i = 0; i < searchLimit; i++) {
    const current = nonEmptyCount(rows[i]);
    const next = nonEmptyCount(rows[i + 1]);
    if (current >= 2 && current === next) return i;
  }
  return 0;
}

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function parseSpreadsheet(
  buffer: Buffer,
  fileName: string,
): { rows: Record<string, unknown>[]; report: CleaningReport } {
  let workbook: XLSX.WorkBook;
  let encoding: 'utf-8' | 'latin1' = 'utf-8';

  if (isCsvFile(fileName)) {
    const decoded = decodeCsvBuffer(buffer);
    encoding = decoded.encoding;
    workbook = XLSX.read(decoded.content, { type: 'string', cellDates: true });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const headerRowIndex = detectHeaderRowIndex(grid);
  const headerRow = grid[headerRowIndex] ?? [];
  const dataRows = grid
    .slice(headerRowIndex + 1)
    .filter((row) => nonEmptyCount(row) > 0);

  const headers = headerRow.map((cell, index) =>
    cell === null || cell === undefined || cell === ''
      ? `col_${index}`
      : String(cell).trim(),
  );

  // Entirely-blank columns: every data row has a null/empty cell at that index.
  const droppedIndexes = new Set<number>();
  for (let col = 0; col < headers.length; col++) {
    const allBlank = dataRows.every((row) => {
      const cell = row[col];
      return cell === null || cell === undefined || cell === '';
    });
    if (allBlank) droppedIndexes.add(col);
  }

  const rows = dataRows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (droppedIndexes.has(index)) return;
      record[header] = trimIfString(row[index] ?? null);
    });
    return record;
  });

  return {
    rows,
    report: {
      encoding,
      headerRowIndex,
      droppedBlankColumns: headers.filter((_, index) =>
        droppedIndexes.has(index),
      ),
    },
  };
}

const SAMPLE_SIZE = 200;

export function inferColumnTypes(
  rows: Record<string, unknown>[],
  headers: string[],
): Record<string, ColumnType> {
  const sample = rows.slice(0, SAMPLE_SIZE);
  const types: Record<string, ColumnType> = {};

  for (const header of headers) {
    const values = sample
      .map((row) => row[header])
      .filter((v) => v !== null && v !== undefined && v !== '');
    types[header] =
      values.length === 0 ? 'text' : inferSingleColumnType(values);
  }
  return types;
}

function inferSingleColumnType(values: unknown[]): ColumnType {
  if (values.every(isBooleanLike)) return 'boolean';
  if (values.every(isNumericLike)) return 'numeric';
  if (values.every(isDateLike)) return 'date';
  return 'text';
}

function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string')
    return ['true', 'false', 'oui', 'non', 'yes', 'no'].includes(
      value.trim().toLowerCase(),
    );
  return false;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string')
    return value.trim() !== '' && Number.isFinite(Number(value));
  return false;
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string')
    return (
      /^\d{4}-\d{2}-\d{2}/.test(value.trim()) &&
      !Number.isNaN(Date.parse(value))
    );
  return false;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 55);
}

export function normalizeTableName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.(xlsx|csv|xls)$/i, '');
  return `src_${slugify(withoutExtension) || 'table'}`;
}

export function normalizeColumnName(header: string, index: number): string {
  const slug = slugify(String(header));
  if (!slug) return `col_${index}`;
  return slug === 'id' ? 'id_src' : slug;
}

export function normalizeValue(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined || value === '') return null;

  switch (type) {
    case 'numeric':
      return typeof value === 'number' ? value : Number(value);
    case 'date':
      return value instanceof Date ? value : new Date(String(value));
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return ['true', 'oui', 'yes', '1'].includes(
        String(value).trim().toLowerCase(),
      );
    default:
      return String(value);
  }
}
