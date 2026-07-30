import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

export interface RetentionPolicy {
  dataType: string;
  duration: number;
  unit: 'hours' | 'days' | 'months' | 'years';
  status: 'active' | 'legal_hold';
}

@Injectable()
export class RetentionSettingsService {
  constructor(private readonly auditService: AuditService) {}

  /** Every change must be audited with before/after values — see section 6bis, never overwritten silently. */
  async update(dataType: string, next: Omit<RetentionPolicy, 'dataType'>, actorUserId: string): Promise<RetentionPolicy> {
    void dataType;
    void next;
    void actorUserId;
    throw new Error('Not implemented');
  }
}
