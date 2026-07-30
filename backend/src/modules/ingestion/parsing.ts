import * as XLSX from 'xlsx';
import type { ColumnType } from './ingestion.service';


export function parseSpreadsheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

const SAMPLE_SIZE = 200;

export function inferColumnTypes(rows: Record<string, unknown>[], headers: string[]): Record<string, ColumnType> {
  const sample = rows.slice(0, SAMPLE_SIZE);
  const types: Record<string, ColumnType> = {};

  for (const header of headers) {
    const values = sample.map((row) => row[header]).filter((v) => v !== null && v !== undefined && v !== '');
    types[header] = values.length === 0 ? 'text' : inferSingleColumnType(values);
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
  if (typeof value === 'string') return ['true', 'false', 'oui', 'non', 'yes', 'no'].includes(value.trim().toLowerCase());
  return false;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Number(value));
  return false;
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value.trim()) && !Number.isNaN(Date.parse(value));
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
      return ['true', 'oui', 'yes', '1'].includes(String(value).trim().toLowerCase());
    default:
      return String(value);
  }
}

