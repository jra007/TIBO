export interface IngestionResult {
  fileName: string;
  tableName: string;
  rowCount: number;
  status: 'success' | 'error';
  errors: string[];
}

export type RelationStatus = 'proposed' | 'validated' | 'rejected';

export interface DetectedRelation {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidenceScore: number;
  status: RelationStatus;
  validatedBy?: string;
  validatedAt?: string;
}

export interface UploadResponse {
  imports: IngestionResult[];
  relations: DetectedRelation[];
}
