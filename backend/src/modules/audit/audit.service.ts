import { Injectable } from '@nestjs/common';

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
 * compliance-approved retention jobs.
 */
@Injectable()
export class AuditService {
  async record(entry: Omit<AuditEntry, 'occurredAt'>): Promise<void> {
    void entry;
    throw new Error('Not implemented: append entry to WORM-backed audit store');
  }
}
