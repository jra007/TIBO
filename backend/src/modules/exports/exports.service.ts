import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import * as XLSX from 'xlsx';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import { buildViewDataQuery } from '../views/view-query-builder';

@Injectable()
export class ExportsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  async exportToPdf(viewOrDashboardId: string): Promise<Buffer> {
    void viewOrDashboardId;
    throw new Error('Not implemented: needs a headless-browser rendering pipeline (Puppeteer/Playwright), not yet added');
  }

  /** SheetJS-based export of underlying data, headers + types preserved. Streamed directly in the
   * HTTP response, never written to disk — trivially satisfies the "never stored beyond 1h" retention
   * rule for temporary exports (section 6bis) since nothing persists to begin with. */
  async exportToExcel(viewId: string, actorUserId: string): Promise<Buffer> {
    const view = await this.knex('views').where({ id: viewId }).first();
    if (!view) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, query, mapRow } = await buildViewDataQuery(this.knex, view.shelves, view.relation_ids);
    const rows = (await query).map(mapRow);

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    await this.auditService.record({ actorUserId, action: 'export.excel', target: viewId });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
