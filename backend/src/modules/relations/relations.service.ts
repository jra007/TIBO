import { Injectable } from '@nestjs/common';

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
  validatedAt?: Date;
}

@Injectable()
export class RelationsService {
  /** Delegates the scoring itself to the Python relation-detection service (name similarity, type, cardinality, Jaccard/containment). */
  async detectRelations(tableNames: string[]): Promise<DetectedRelation[]> {
    void tableNames;
    throw new Error('Not implemented: call relation-detection service and persist proposals');
  }

  async validate(relationId: string, adminUserId: string): Promise<DetectedRelation> {
    void relationId;
    void adminUserId;
    throw new Error('Not implemented');
  }

  async reject(relationId: string, adminUserId: string): Promise<DetectedRelation> {
    void relationId;
    void adminUserId;
    throw new Error('Not implemented: mark rejected, cascade views using it to "à corriger", notify owners');
  }
}
