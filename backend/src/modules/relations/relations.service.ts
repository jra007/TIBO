import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ColumnProfilerService } from './column-profiler.service';

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

interface RelationCandidateDto {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence_score: number;
  name_similarity: number;
  type_compatible: boolean;
  cardinality_score: number;
  containment: number;
}

interface DetectedRelationRow {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence_score: string;
  status: RelationStatus;
  validated_by: string | null;
  validated_at: Date | null;
}

const RELATION_DETECTION_URL = process.env.RELATION_DETECTION_URL || 'http://localhost:8001';

function toDomain(row: DetectedRelationRow): DetectedRelation {
  return {
    id: row.id,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    targetTable: row.target_table,
    targetColumn: row.target_column,
    confidenceScore: Number(row.confidence_score),
    status: row.status,
    validatedBy: row.validated_by ?? undefined,
    validatedAt: row.validated_at ?? undefined,
  };
}

@Injectable()
export class RelationsService {
  private readonly logger = new Logger(RelationsService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly profiler: ColumnProfilerService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Delegates the scoring itself to the Python relation-detection service (name similarity, type, cardinality, Jaccard/containment). */
  async detectRelations(tableNames?: string[]): Promise<DetectedRelation[]> {
    const tables = tableNames?.length ? tableNames : await this.profiler.listSourceTables();
    if (tables.length < 2) return [];

    const columns = await this.profiler.profileTables(tables);
    const response = await fetch(`${RELATION_DETECTION_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns }),
    });
    if (!response.ok) throw new Error(`relation-detection service returned ${response.status}`);
    const { candidates } = (await response.json()) as { candidates: RelationCandidateDto[] };

    for (const candidate of candidates) {
      await this.upsertCandidate(candidate);
    }

    const rows: DetectedRelationRow[] = await this.knex('detected_relations')
      .whereIn('source_table', tables)
      .orWhereIn('target_table', tables)
      .orderBy('confidence_score', 'desc');
    return rows.map(toDomain);
  }

  private async upsertCandidate(candidate: RelationCandidateDto): Promise<void> {
    const existing = await this.knex('detected_relations')
      .where({
        source_table: candidate.source_table,
        source_column: candidate.source_column,
        target_table: candidate.target_table,
        target_column: candidate.target_column,
      })
      .orWhere({
        source_table: candidate.target_table,
        source_column: candidate.target_column,
        target_table: candidate.source_table,
        target_column: candidate.source_column,
      })
      .first();

    // A relation already validated or rejected by an admin is a decision, not re-scored silently.
    if (existing && existing.status !== 'proposed') return;

    const scoreFields = {
      confidence_score: candidate.confidence_score,
      name_similarity: candidate.name_similarity,
      type_compatible: candidate.type_compatible,
      cardinality_score: candidate.cardinality_score,
      containment: candidate.containment,
    };

    if (existing) {
      await this.knex('detected_relations').where({ id: existing.id }).update(scoreFields);
    } else {
      await this.knex('detected_relations').insert({
        source_table: candidate.source_table,
        source_column: candidate.source_column,
        target_table: candidate.target_table,
        target_column: candidate.target_column,
        status: 'proposed',
        ...scoreFields,
      });
    }
  }

  async list(status?: RelationStatus): Promise<DetectedRelation[]> {
    const query = this.knex('detected_relations').orderBy('confidence_score', 'desc');
    const rows: DetectedRelationRow[] = status ? await query.where({ status }) : await query;
    return rows.map(toDomain);
  }

  async validate(relationId: string, adminUserId: string): Promise<DetectedRelation> {
    return this.setStatus(relationId, 'validated', adminUserId);
  }

  async reject(relationId: string, adminUserId: string): Promise<DetectedRelation> {
    const relation = await this.setStatus(relationId, 'rejected', adminUserId);
    await this.notifyAffectedViewOwners(relation);
    return relation;
  }

  /**
   * A view's relationStatus is derived live (see ViewsService.computeRelationStatus), so it flips
   * to "à corriger" automatically — no view row needs updating here. What still requires an
   * explicit action is telling the owner, per the spec's "notifié dans l'interface" requirement.
   */
  private async notifyAffectedViewOwners(relation: DetectedRelation): Promise<void> {
    const affectedViews = await this.knex('views').whereRaw('relation_ids @> ?::jsonb', [JSON.stringify([relation.id])]);

    for (const view of affectedViews) {
      await this.notificationsService.notify({
        recipientUserId: view.owner_id,
        subject: `Vue "${view.name}" à corriger`,
        body: `La relation ${relation.sourceTable}.${relation.sourceColumn} ↔ ${relation.targetTable}.${relation.targetColumn} utilisée par cette vue a été rejetée par un administrateur.`,
      });
    }
  }

  private async setStatus(relationId: string, status: RelationStatus, adminUserId: string): Promise<DetectedRelation> {
    const before = await this.knex('detected_relations').where({ id: relationId }).first();
    if (!before) throw new NotFoundException(`Relation ${relationId} not found`);

    const update = { status, validated_by: adminUserId, validated_at: new Date() };
    await this.knex('detected_relations').where({ id: relationId }).update(update);
    const after = { ...before, ...update };

    await this.auditService.record({
      actorUserId: adminUserId,
      action: `relation.${status}`,
      target: relationId,
      before,
      after,
    });

    return toDomain(after);
  }
}
