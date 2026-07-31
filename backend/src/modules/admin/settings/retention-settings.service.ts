import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { AuditService } from '../../audit/audit.service';

export interface RetentionPolicy {
  dataType: string;
  duration: number;
  unit: 'hours' | 'days' | 'months' | 'years';
  status: 'active' | 'legal_hold';
}

interface RetentionPolicyRow {
  data_type: string;
  duration: number;
  unit: RetentionPolicy['unit'];
  status: RetentionPolicy['status'];
  last_modified_by: string | null;
  last_modified_at: Date;
}

function toDomain(row: RetentionPolicyRow): RetentionPolicy {
  return { dataType: row.data_type, duration: row.duration, unit: row.unit, status: row.status };
}

@Injectable()
export class RetentionSettingsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<RetentionPolicy[]> {
    const rows: RetentionPolicyRow[] = await this.knex('retention_policy').orderBy('data_type');
    return rows.map(toDomain);
  }

  /** Every change is audited with before/after values — see section 6bis, never overwritten silently. */
  async update(dataType: string, next: Omit<RetentionPolicy, 'dataType'>, actorUserId: string): Promise<RetentionPolicy> {
    const before: RetentionPolicyRow | undefined = await this.knex('retention_policy').where({ data_type: dataType }).first();

    const update = {
      duration: next.duration,
      unit: next.unit,
      status: next.status,
      last_modified_by: actorUserId,
      last_modified_at: new Date(),
    };

    const [after]: RetentionPolicyRow[] = before
      ? await this.knex('retention_policy').where({ data_type: dataType }).update(update).returning('*')
      : await this.knex('retention_policy')
          .insert({ data_type: dataType, ...update })
          .returning('*');

    await this.auditService.record({
      actorUserId,
      action: 'retention.update',
      target: dataType,
      before: before ? toDomain(before) : null,
      after: toDomain(after),
    });

    return toDomain(after);
  }
}
