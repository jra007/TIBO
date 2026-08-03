import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import * as XLSX from 'xlsx';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import {
  ReportPdfRendererService,
  type ReportSection,
} from '../reports/report-pdf-renderer.service';
import type { FilterCondition } from '../views/views.service';
import { buildViewDataQuery } from '../views/view-query-builder';

/** Swaps each row's internal "table.column" keys for their display label, for human-facing exports. */
function relabelRows(
  rows: Record<string, unknown>[],
  headers: string[],
  headerLabels: string[],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, i) => [headerLabels[i], row[header]]),
    ),
  );
}

/**
 * Excel/CSV formula injection guard. A view's data is ingested business content — often sourced
 * from an external counterparty's file, not something TIBO controls the shape of — and a cell
 * value starting with =, +, -, or @ is evaluated as a formula the moment a recipient opens the
 * exported .xlsx in real Excel, regardless of how SheetJS itself typed the cell in the file. That
 * lets whoever supplied the source data (not necessarily the TIBO user exporting it) plant a
 * payload — e.g. a HYPERLINK()/WEBSERVICE() call exfiltrating the rest of the row to an external
 * URL — that only fires downstream, in a colleague's spreadsheet. Prefixing with a leading
 * apostrophe is the standard mitigation (OWASP CSV/formula injection guidance): it forces Excel
 * to treat the value as literal text. The apostrophe itself becomes visible in the cell — an
 * accepted, minor cost for closing an otherwise real injection path.
 */
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

function sanitizeForSpreadsheet(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' &&
        value.length > 0 &&
        FORMULA_TRIGGER_CHARS.has(value[0])
          ? `'${value}`
          : value,
      ]),
    ),
  );
}

interface ViewSection {
  name: string;
  headerLabels: string[];
  rows: Record<string, unknown>[];
}

@Injectable()
export class ExportsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly auditService: AuditService,
    private readonly reportPdfRenderer: ReportPdfRendererService,
  ) {}

  /** Loads one view's data exactly as the live app would show it — same quick-stat columns, same date-selector scoping — so an export never silently differs from what's on screen. */
  private async loadViewSection(
    viewId: string,
    selectedDate?: string,
    runtimeFilters: FilterCondition[] = [],
  ): Promise<ViewSection & { view: { name: string } }> {
    const view = await this.knex('views').where({ id: viewId }).first();
    if (!view) throw new NotFoundException(`View ${viewId} not found`);

    const { headers, headerLabels, query, mapRow } = await buildViewDataQuery(
      this.knex,
      view.shelves,
      view.relation_ids,
      view.calculated_fields,
      view.quick_stat_fields,
      selectedDate,
      runtimeFilters,
    );
    const rows = relabelRows((await query).map(mapRow), headers, headerLabels);
    return { view, name: view.name, headerLabels, rows };
  }

  /** Streamed directly in the response, never written to disk — same "never stored" reasoning as Excel. */
  async exportToPdf(
    viewId: string,
    actorUserId: string,
    selectedDate?: string,
    runtimeFilters: FilterCondition[] = [],
  ): Promise<Buffer> {
    const { name, headerLabels, rows } = await this.loadViewSection(
      viewId,
      selectedDate,
      runtimeFilters,
    );
    const buffer = await this.reportPdfRenderer.renderTable(
      name,
      headerLabels,
      rows,
    );
    await this.auditService.record({
      actorUserId,
      action: 'export.pdf',
      target: viewId,
    });
    return buffer;
  }

  /** SheetJS-based export of underlying data, headers + types preserved. Streamed directly in the
   * HTTP response, never written to disk — trivially satisfies the "never stored beyond 1h" retention
   * rule for temporary exports (section 6bis) since nothing persists to begin with. */
  async exportToExcel(
    viewId: string,
    actorUserId: string,
    selectedDate?: string,
    runtimeFilters: FilterCondition[] = [],
  ): Promise<Buffer> {
    const { name, headerLabels, rows } = await this.loadViewSection(
      viewId,
      selectedDate,
      runtimeFilters,
    );

    const worksheet = XLSX.utils.json_to_sheet(sanitizeForSpreadsheet(rows), {
      header: headerLabels,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(name));

    await this.auditService.record({
      actorUserId,
      action: 'export.excel',
      target: viewId,
    });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** One combined PDF for a whole dashboard — every tile's view becomes its own section, starting on a fresh page, sharing a single branded header/footer. */
  async exportDashboardToPdf(
    dashboardId: string,
    actorUserId: string,
    selectedDate?: string,
  ): Promise<Buffer> {
    const dashboard = await this.knex('dashboards')
      .where({ id: dashboardId })
      .first();
    if (!dashboard)
      throw new NotFoundException(`Dashboard ${dashboardId} not found`);

    const viewIds: string[] = dashboard.view_ids ?? [];
    const sections: ReportSection[] = [];
    for (const viewId of viewIds) {
      const { name, headerLabels, rows } = await this.loadViewSection(
        viewId,
        selectedDate,
      );
      sections.push({ title: name, headers: headerLabels, rows });
    }

    const buffer = await this.reportPdfRenderer.renderSections(
      dashboard.name,
      sections,
    );
    await this.auditService.record({
      actorUserId,
      action: 'export.pdf.dashboard',
      target: dashboardId,
    });
    return buffer;
  }

  /** One workbook, one sheet per tile's view — the natural multi-table extension of the single-view Excel export. */
  async exportDashboardToExcel(
    dashboardId: string,
    actorUserId: string,
    selectedDate?: string,
  ): Promise<Buffer> {
    const dashboard = await this.knex('dashboards')
      .where({ id: dashboardId })
      .first();
    if (!dashboard)
      throw new NotFoundException(`Dashboard ${dashboardId} not found`);

    const viewIds: string[] = dashboard.view_ids ?? [];
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    for (const viewId of viewIds) {
      const { name, headerLabels, rows } = await this.loadViewSection(
        viewId,
        selectedDate,
      );
      const worksheet = XLSX.utils.json_to_sheet(sanitizeForSpreadsheet(rows), {
        header: headerLabels,
      });
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        uniqueSheetName(name, usedNames),
      );
    }

    await this.auditService.record({
      actorUserId,
      action: 'export.excel.dashboard',
      target: dashboardId,
    });
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}

/** Excel sheet names can't exceed 31 chars or contain []:*?/\ — a view/dashboard name easily violates either. */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Data';
}

function uniqueSheetName(name: string, used: Set<string>): string {
  const base = sheetName(name);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 28)} ${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
