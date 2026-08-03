import * as XLSX from 'xlsx';
import type { ColumnType } from './ingestion.service';

/** What cleanup (automatic or assisted) did to a file, for the ingestion journal — see TIBO_addendum_nettoyage_fichiers.md sections 2 and 5. */
export interface CleaningReport {
  encoding: 'utf-8' | 'latin1';
  /** 0 = the header was already on the first row; >0 = that many leading rows (title/free text) were skipped. */
  headerRowIndex: number;
  /** Blank or manually excluded (a memorized rule doesn't distinguish the two after the fact). */
  droppedColumns: string[];
  /** Rows actually kept after any trailing exclusion — the anomaly guard's baseline (see IngestionService). */
  keptRowCount: number;
  /** Rows dropped by a trailing exclusion (a memorized rule's or a fresh correction's), 0 if none applies. */
  trailingRowsExcluded: number;
  /** Original header text that appeared more than once in the file — every occurrence after the
   * first was renamed (e.g. second "Montant" becomes "Montant_2") to avoid silently losing a whole
   * column's data: `record[header] = ...` in a plain object would otherwise let the last-occurring
   * column silently overwrite every earlier one sharing its name, with no error and no trace. */
  duplicateColumnsRenamed: string[];
  /** Names of extra sheets in a multi-sheet Excel file that were NOT imported — only the first
   * sheet is ever read. Always empty for CSV (single-sheet by construction). */
  skippedSheets: string[];
  /** Columns where more than one currency symbol/code was seen across the sampled rows (e.g. some
   * rows "CHF 100", others "EUR 100") — summing such a column silently mixes currencies as if they
   * were the same unit. Populated after ingestion (column typing happens in IngestionService, not
   * parseSpreadsheet), merged into the journal entry before it's written — see ingestFile. */
  mixedCurrencyColumns: string[];
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

/**
 * Common "missing value" placeholders finance/banking exports use instead of a genuinely empty
 * cell. Deliberately a short, unambiguous list — a bare "NA" or a lone "-" are left OUT on purpose
 * even though they're common sentinels too, because they collide with real data ("NA" is Namibia's
 * ISO country code; a lone "-" can be a meaningful text value in its own right) — a false-positive
 * here would silently delete a real value, which is worse than the problem being solved.
 *
 * The reason this matters at all: inferSingleColumnType requires every value in the type-inference
 * sample to pass isNumericLike/isDateLike — a single one of these tokens surviving as a plain
 * string would flip an otherwise entirely numeric/date column to text, silently, for the whole
 * column (not just that one row).
 */
const MISSING_VALUE_SENTINELS = new Set([
  'n/a',
  'n.a.',
  'null',
  '#n/a',
  '#value!',
  '#ref!',
  '#div/0!',
  'n/d',
  's.o.',
  '--',
]);

function normalizeCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return MISSING_VALUE_SENTINELS.has(trimmed.toLowerCase()) ? null : trimmed;
}

/**
 * A data-admin-validated correction for a file that the automatic heuristic couldn't confidently
 * resolve — see the assisted-correction flow (nettoyage addendum, section 3).
 *
 * `trailingRowsToExclude` is a count, not an absolute row index: a recurring daily export's row
 * count varies with data volume, so a trailing total/comment row sits at a different absolute
 * position each day. Storing "drop the last N rows of data" survives that variation; an absolute
 * index (the file's row N) would silently start excluding real data instead the day the row count
 * changes. Column indexes don't have this problem — a file's column layout is stable across
 * imports even when its row count isn't — so those stay absolute.
 */
export interface CleaningCorrection {
  headerRowIndex: number;
  trailingRowsToExclude: number;
  excludedColumnIndexes: number[];
}

function buildGrid(
  buffer: Buffer,
  fileName: string,
): {
  grid: unknown[][];
  encoding: 'utf-8' | 'latin1';
  skippedSheets: string[];
} {
  let workbook: XLSX.WorkBook;
  let encoding: 'utf-8' | 'latin1' = 'utf-8';

  if (isCsvFile(fileName)) {
    const decoded = decodeCsvBuffer(buffer);
    encoding = decoded.encoding;
    // `raw: true` here (a `read`-level option, distinct from sheet_to_json's own `raw` below)
    // stops SheetJS's own plaintext number/date auto-detection from running on CSV cells — left
    // on, it silently mangled European-formatted numbers (e.g. "2.345,67" became the JS number
    // 2.34567: it stripped the comma as if it were a stray thousands separator and read the rest
    // as a plain float, off by ~1000x with no error). Every cell now arrives as a plain string, so
    // isNumericLike/isDateLike/parseFlexibleNumber (below) are the single source of truth for
    // typing a CSV column, instead of two independent and disagreeing heuristics.
    workbook = XLSX.read(decoded.content, {
      type: 'string',
      cellDates: true,
      raw: true,
    });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  // Only the first sheet is ever read — a spreadsheet with several tabs (e.g. one per month, or a
  // summary tab alongside the detail data) would otherwise have every sheet past the first
  // silently ignored, with nothing in the ingestion result to say so. Surfaced via skippedSheets
  // instead, all the way out to the CleaningReport, so it's at least visible and traceable rather
  // than a quiet, undetectable gap in what got imported.
  const [firstSheetName, ...skippedSheets] = workbook.SheetNames;
  const sheet = workbook.Sheets[firstSheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  return { grid, encoding, skippedSheets };
}

const PREVIEW_HEAD_ROWS = 25;
const PREVIEW_TAIL_ROWS = 10;

export interface PreviewRow {
  /** Absolute position in the raw grid — a manual header/exclude selection references this, not the row's position within the (possibly head+tail-only) preview list. */
  index: number;
  cells: unknown[];
}

/** Grid preview for the assisted-correction UI (never touches the database) — head+tail only, since the rows needing a decision (a title row, a total row) are always at the edges of the file, and showing the full grid for a large import would be impractical. */
export function previewGrid(
  buffer: Buffer,
  fileName: string,
): {
  rows: PreviewRow[];
  totalRows: number;
  suggestedHeaderRowIndex: number;
  skippedSheets: string[];
} {
  const { grid, skippedSheets } = buildGrid(buffer, fileName);
  const suggestedHeaderRowIndex = detectHeaderRowIndex(grid);
  const indexed: PreviewRow[] = grid.map((cells, index) => ({ index, cells }));
  const rows =
    indexed.length <= PREVIEW_HEAD_ROWS + PREVIEW_TAIL_ROWS
      ? indexed
      : [
          ...indexed.slice(0, PREVIEW_HEAD_ROWS),
          ...indexed.slice(-PREVIEW_TAIL_ROWS),
        ];
  return {
    rows,
    totalRows: grid.length,
    suggestedHeaderRowIndex,
    skippedSheets,
  };
}

/**
 * Disambiguates header text that appears more than once (e.g. two columns both literally named
 * "Montant") by appending a numeric suffix to every occurrence after the first. Without this, the
 * row-building step below (`record[header] = ...`) would let the last-occurring column silently
 * overwrite every earlier column sharing its name in the resulting plain object — the earlier
 * column's data wouldn't error, wouldn't warn, it would just be gone. Checks the suffixed candidate
 * against every header seen so far (not just a counter) so it can't collide with a real, distinct
 * column that already happens to be named e.g. "Montant_2".
 */
function dedupeHeaders(rawHeaders: string[]): {
  headers: string[];
  renamed: string[];
} {
  const seen = new Set<string>();
  const renamed: string[] = [];
  const headers = rawHeaders.map((header) => {
    if (!seen.has(header)) {
      seen.add(header);
      return header;
    }
    renamed.push(header);
    let suffix = 2;
    let candidate = `${header}_${suffix}`;
    while (seen.has(candidate)) {
      suffix += 1;
      candidate = `${header}_${suffix}`;
    }
    seen.add(candidate);
    return candidate;
  });
  return { headers, renamed };
}

export function parseSpreadsheet(
  buffer: Buffer,
  fileName: string,
  correction?: CleaningCorrection,
): {
  rows: Record<string, unknown>[];
  headers: string[];
  report: CleaningReport;
} {
  const { grid, encoding, skippedSheets } = buildGrid(buffer, fileName);

  const headerRowIndex = correction
    ? correction.headerRowIndex
    : detectHeaderRowIndex(grid);
  const headerRow = grid[headerRowIndex] ?? [];
  const trailingRowsToExclude = correction?.trailingRowsToExclude ?? 0;
  const nonEmptyDataRows = grid
    .slice(headerRowIndex + 1)
    .filter((row) => nonEmptyCount(row) > 0);
  const dataRows =
    trailingRowsToExclude > 0
      ? nonEmptyDataRows.slice(0, -trailingRowsToExclude)
      : nonEmptyDataRows;

  const rawHeaders = headerRow.map((cell, index) =>
    cell === null || cell === undefined || cell === ''
      ? `col_${index}`
      : String(cell).trim(),
  );
  const { headers, renamed: duplicateColumnsRenamed } =
    dedupeHeaders(rawHeaders);

  // Entirely-blank columns: every data row has a null/empty cell at that index. A manually
  // excluded column (correction.excludedColumnIndexes) is dropped the same way.
  const excludedColumns = new Set(correction?.excludedColumnIndexes ?? []);
  const droppedIndexes = new Set<number>(excludedColumns);
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
      record[header] = normalizeCell(row[index] ?? null);
    });
    return record;
  });
  const keptHeaders = headers.filter((_, index) => !droppedIndexes.has(index));

  return {
    rows,
    headers: keptHeaders,
    report: {
      encoding,
      headerRowIndex,
      droppedColumns: headers.filter((_, index) => droppedIndexes.has(index)),
      keptRowCount: dataRows.length,
      trailingRowsExcluded: nonEmptyDataRows.length - dataRows.length,
      duplicateColumnsRenamed: [...new Set(duplicateColumnsRenamed)],
      skippedSheets,
      mixedCurrencyColumns: [],
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

/**
 * Column names (already typed 'numeric' by inferColumnTypes) where more than one currency
 * symbol/code appears across the sampled rows — e.g. some rows "CHF 100", others "EUR 100". The
 * numeric value itself parses fine either way (parseFlexibleNumber strips whichever currency is
 * present), which is exactly the danger: summing the column silently treats every row as the same
 * unit. Doesn't block the import — the numbers are still real numbers — just surfaces it so a data
 * admin can check whether that's actually true for this file, the same "make it visible instead of
 * guessing" approach as skippedSheets/duplicateColumnsRenamed above.
 */
export function detectMixedCurrencyColumns(
  rows: Record<string, unknown>[],
  headers: string[],
  columnTypes: Record<string, ColumnType>,
): string[] {
  const sample = rows.slice(0, SAMPLE_SIZE);
  const flagged: string[] = [];

  for (const header of headers) {
    if (columnTypes[header] !== 'numeric') continue;
    const currencies = new Set<string>();
    for (const row of sample) {
      const value = row[header];
      if (typeof value !== 'string') continue;
      const { currency } = stripCurrencyToken(value.trim());
      if (currency) currencies.add(currency);
    }
    if (currencies.size > 1) flagged.push(header);
  }
  return flagged;
}

function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string')
    return ['true', 'false', 'oui', 'non', 'yes', 'no'].includes(
      value.trim().toLowerCase(),
    );
  return false;
}

/** Space (incl. non-breaking), straight/curly apostrophe — the thousands groupers seen in European/Swiss exports. */
const THOUSANDS_CHARS = /[\s'’]/g;

/** Currency symbols/ISO codes seen attached directly to a value in finance exports, e.g. "CHF 1'234.50" or "1'234.50 CHF". Not `g`-flagged: used with `.exec()` below to also report which currency was found (see stripCurrencyToken), not just to strip it. */
const CURRENCY_TOKEN =
  /^(chf|eur|usd|gbp|[€$£])\s*|\s*(chf|eur|usd|gbp|[€$£])$/i;

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

/**
 * Strips a leading/trailing currency symbol or ISO code if present, and reports which currency
 * (normalized to an ISO-ish code) was found — used both to get the bare number for parsing
 * (parseFlexibleNumber) and to detect a column silently mixing currencies across rows (see
 * detectMixedCurrencyColumns), which parsing the number alone would otherwise lose track of.
 */
function stripCurrencyToken(raw: string): {
  rest: string;
  currency: string | null;
} {
  const match = CURRENCY_TOKEN.exec(raw);
  if (!match) return { rest: raw, currency: null };
  const token = match[1] ?? match[2];
  const rest =
    raw.slice(0, match.index) + raw.slice(match.index + match[0].length);
  return {
    rest,
    currency:
      CURRENCY_SYMBOL_TO_CODE[token.toLowerCase()] ?? token.toUpperCase(),
  };
}

/** Parses the digits/separators only — sign and currency are already stripped by parseFlexibleNumber before this runs. */
function parseUnsignedSeparatedNumber(trimmed: string): number | null {
  if (trimmed === '') return null;
  const plain = Number(trimmed);
  if (Number.isFinite(plain)) return plain;

  // Comma decimal, with dot/space/apostrophe thousands groupers: "1.234,56" / "1 234,56" / "1234,56"
  if (/^[\d.\s'’]+,\d{1,2}$/.test(trimmed)) {
    const [intPart, fracPart] = trimmed.split(',');
    const value = Number(
      `${intPart.replace(THOUSANDS_CHARS, '').replace(/\./g, '')}.${fracPart}`,
    );
    return Number.isFinite(value) ? value : null;
  }

  // Dot decimal, space/apostrophe thousands groupers only (Swiss style): "1'234.50" / "1 234.50"
  if (/^[\d\s'’]+\.\d{1,2}$/.test(trimmed)) {
    const value = Number(trimmed.replace(THOUSANDS_CHARS, ''));
    return Number.isFinite(value) ? value : null;
  }

  // Pure thousands-grouped integer, no decimal part: "1'234" / "1 234 567"
  if (/^\d{1,3}([\s'’]\d{3})+$/.test(trimmed)) {
    const value = Number(trimmed.replace(THOUSANDS_CHARS, ''));
    return Number.isFinite(value) ? value : null;
  }

  // US-style comma thousands + dot decimal: "1,234.56" / "1,234,567.89" — unambiguous regardless
  // of how many comma-groups there are, because the trailing dot-decimal fixes which mark is which
  // (the European convention would write the same value with the two separators swapped).
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(trimmed)) {
    const value = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  // Pure US-style comma-thousands integer, no decimal shown: "1,234,567". Requires 2+ comma-groups
  // — a single group ("1,234") is exactly the ambiguous case documented above and stays unparsed;
  // two or more groups can only be thousands separators in any convention, never a decimal mark.
  if (/^\d{1,3}(,\d{3}){2,}$/.test(trimmed)) {
    const value = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

/**
 * Parses a number that may use European-style separators — banking/finance exports frequently
 * write a comma as the decimal mark and a space/apostrophe/dot as a thousands grouper (e.g.
 * "1.234,56", "1 234,56"), or the Swiss style of apostrophe-grouped thousands with a dot decimal
 * ("1'234.50") — none of which JS's `Number()` accepts. Also strips a leading/trailing currency
 * symbol or ISO code, and recognizes accounting-style negatives: parentheses ("(1'234.50)", common
 * on financial statements) and a trailing minus sign ("1234.50-", the SAP/mainframe export
 * convention), in addition to a plain leading "-".
 *
 * Deliberately conservative: only resolves a fraction of 1-2 digits, since that's what a real
 * decimal mark looks like for money (cents) or a rate. A lone "1,234" (comma followed by exactly
 * 3 digits, no other separator anywhere) is genuinely ambiguous between "one thousand two hundred
 * thirty-four" and "one point two three four" — that case is deliberately left unparsed (the
 * column falls back to text) rather than guessed at: a wrong silent guess on a financial figure is
 * worse than a column that's visibly still text and gets caught during review.
 */
function parseFlexibleNumber(raw: string): number | null {
  let trimmed = stripCurrencyToken(raw.trim()).rest.trim();
  if (trimmed === '') return null;

  let negative = false;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    negative = true;
    trimmed = trimmed.slice(1, -1).trim();
  } else if (trimmed.endsWith('-')) {
    negative = true;
    trimmed = trimmed.slice(0, -1).trim();
  } else if (trimmed.startsWith('-')) {
    negative = true;
    trimmed = trimmed.slice(1).trim();
  }

  const value = parseUnsignedSeparatedNumber(trimmed);
  if (value === null) return null;
  return negative ? -Math.abs(value) : value;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return parseFlexibleNumber(value) !== null;
  return false;
}

const EUROPEAN_DATE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/;

/**
 * Parses "DD/MM/YYYY" (or `.`/`-` separated, 2- or 4-digit year) — the day-first convention this
 * platform's business context (French/Swiss finance/banking) uses by default. Deliberately a firm,
 * documented convention rather than an attempt at smart disambiguation: unlike a wrong numeric
 * guess (which usually looks like a parse failure), a wrong day/month swap still produces a
 * *plausible-looking* date, so there is no safe way to detect the mistake after the fact — the
 * platform picks day-first and stays with it, the same way the numeric parser picked a fixed UTC
 * day boundary elsewhere in ingestion rather than guessing a business timezone.
 *
 * Rejects anything that isn't a real calendar date rather than letting `Date` silently roll an
 * overflow into the next month (e.g. "31/04" has no April 31st) — a rejected string simply isn't
 * treated as a date, consistent with parseFlexibleNumber's "leave it as text rather than guess"
 * stance elsewhere in this file.
 */
function parseEuropeanDate(trimmed: string): Date | null {
  const match = EUROPEAN_DATE.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date;
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      /^\d{4}-\d{2}-\d{2}/.test(trimmed) &&
      !Number.isNaN(Date.parse(trimmed))
    )
      return true;
    return parseEuropeanDate(trimmed) !== null;
  }
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
      // Same parser that decided this column is numeric in the first place (see isNumericLike) —
      // a plain Number(value) here would silently produce NaN for a value it only classified as
      // numeric via the European-format path (e.g. "1'234,56").
      return typeof value === 'number'
        ? value
        : parseFlexibleNumber(String(value));
    case 'date': {
      // A column is typed 'date' from a 200-row sample (inferColumnTypes) — a later row outside
      // that sample can still hold something unparseable. `new Date(garbage)` doesn't throw, it
      // returns an "Invalid Date" object that later blows up the whole batch insert (the pg driver
      // calls toISOString() on it, which throws) instead of just leaving that one cell empty.
      let parsed: Date;
      if (value instanceof Date) {
        parsed = value;
      } else {
        const str = String(value).trim();
        // Same day-first convention as isDateLike — an ISO-shaped string is never re-interpreted
        // as DD/MM (parseEuropeanDate's own pattern can't match a "YYYY-MM-DD" string anyway, but
        // being explicit here keeps the two functions' precedence obviously in sync).
        parsed = /^\d{4}-\d{2}-\d{2}/.test(str)
          ? new Date(str)
          : (parseEuropeanDate(str) ?? new Date(str));
      }
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return ['true', 'oui', 'yes', '1'].includes(
        String(value).trim().toLowerCase(),
      );
    default:
      return String(value);
  }
}
