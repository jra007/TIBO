import { Injectable } from '@nestjs/common';

export type ColumnType = 'text' | 'date' | 'numeric' | 'boolean';

export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error';
  errors: string[];
}

@Injectable()
export class IngestionService {
  async ingestFile(fileName: string, buffer: Buffer): Promise<IngestionResult> {
    void fileName;
    void buffer;
    throw new Error('Not implemented: parse xlsx/csv, infer column types, create/load table, log to ingestion journal');
  }
}
