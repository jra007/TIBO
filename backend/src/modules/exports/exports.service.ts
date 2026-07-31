import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import * as XLSX from 'xlsx';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import { buildViewDataQuery } from '../views/view-query-builder';
import { buildPrintableHtml, renderHtmlToPdf } from './render-pdf';

/** Swaps each row's internal "table.column" keys for their display label, for human-facing exports. */
function relabelRows(rows: Record<string, unknown>[], headers: string[], headerLabels: string[]): Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(headers.map((header, i) => [headerLabels[i], row[header]])));
}

@Injectable()
export class ExportsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
  ) {}

  /** Streamed directly in the response, never written to disk — same "never stored" reasoning as Excel. */
  async exportToPdf(viewId: string, actorUserId: string): Promise<Buffer> {
    const view = await this.knex('views').where({ id: viewId }).first();
    if (!view) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(this.knex, view.shelves, view.relation_ids);
    const rows = relabelRows((await query).map(mapRow), headers, headerLabels);

    const html = buildPrintableHtml(view.name, headerLabels, rows);
    const buffer = await renderHtmlToPdf(html);

    await this.auditService.record({ actorUserId, action: 'export.pdf', target: viewId });

    return buffer;
  }

  /** SheetJS-based export of underlying data, headers + types preserved. Streamed directly in the
   * HTTP response, never written to disk — trivially satisfies the "never stored beyond 1h" retention
   * rule for temporary exports (section 6bis) since nothing persists to begin with. */
  async exportToExcel(viewId: string, actorUserId: string): Promise<Buffer> {
    const view = await this.knex('views').where({ id: viewId }).first();
    if (!view) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(this.knex, view.shelves, view.relation_ids);
    const rows = relabelRows((await query).map(mapRow), headers, headerLabels);

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headerLabels });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    await this.auditService.record({ actorUserId, action: 'export.excel', target: viewId });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
