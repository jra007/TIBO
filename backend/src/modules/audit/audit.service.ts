import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  target: string;
  before?: unknown;
  after?: unknown;
  occurredAt: Date;
}

/**
 * Write-only by design: audit entries must never be updated or deleted by application code,
 * only appended (see WORM requirement in section 6bis of the spec) and purged by explicit
 * compliance-approved retention jobs. True WORM (revoked UPDATE/DELETE grants at the DB role
 * level) is a deployment-environment concern, not yet applied to this dev database.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async record(entry: Omit<AuditEntry, 'occurredAt'>): Promise<void> {
    await this.knex('audit_log').insert({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target: entry.target,
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
    });
  }
}
