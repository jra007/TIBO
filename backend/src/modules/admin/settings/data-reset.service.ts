import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { AuditService } from '../../audit/audit.service';

/** Business data wiped by a full reset — everything the user can re-derive by re-ingesting. */
const DATA_TABLES = ['ingestion_journal', 'detected_relations', 'views', 'dashboards', 'column_labels', 'notifications'];

/** Must be typed verbatim by the caller — a full reset is irreversible and not something a stray click should trigger. */
const CONFIRMATION_PHRASE = 'SUPPRIMER TOUT';

export interface DataResetSummary {
  droppedTables: string[];
  clearedRowCounts: Record<string, number>;
}

@Injectable()
export class DataResetService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Wipes all ingested business data (source tables, journal, relations, views, dashboards,
   * labels, notifications) so the platform can be relaunched from a clean slate. Deliberately
   * never touches users/groups/roles/permissions, retention_policy, auth_settings, smtp_settings,
   * or audit_log — the last of which records this very action (WORM, spec 6bis).
   */
  async resetAll(actorUserId: string, confirmation: string): Promise<DataResetSummary> {
    if (confirmation !== CONFIRMATION_PHRASE) {
      throw new BadRequestException(`Confirmation invalide — tapez exactement "${CONFIRMATION_PHRASE}"`);
    }

    const { rows: sourceTables } = await this.knex.raw<{ rows: { table_name: string }[] }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'src\\_%' ORDER BY table_name`,
    );
    const droppedTables = sourceTables.map((row) => row.table_name);

    const clearedRowCounts: Record<string, number> = {};

    await this.knex.transaction(async (trx) => {
      for (const tableName of droppedTables) await trx.schema.dropTableIfExists(tableName);
      for (const table of DATA_TABLES) clearedRowCounts[table] = await trx(table).delete();
    });

    await this.auditService.record({
      actorUserId,
      action: 'data.full_reset',
      target: 'platform',
      after: { droppedTables, clearedRowCounts },
    });

    return { droppedTables, clearedRowCounts };
  }
}
