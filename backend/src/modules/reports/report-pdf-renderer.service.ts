import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import puppeteer from 'puppeteer-core';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { UploadsService } from '../admin/settings/uploads.service';
import { ReportSettingsService } from './report-settings.service';

export interface ReportSection {
  title: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSectionHtml(section: ReportSection, isFirst: boolean, showTitle: boolean): string {
  const headerCells = section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const bodyRows = section.rows
    .map((row) => `<tr>${section.headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ''))}</td>`).join('')}</tr>`)
    .join('');

  return `
    <section${isFirst ? '' : ' class="report-section-break"'}>
      ${showTitle ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </section>`;
}

/** The main document body — a proper report look (typography, zebra-striped rows, section spacing), not the bare title+table it used to be. The branded header/footer are separate templates (see renderPdf), stamped on every page by Chromium itself. A lone section repeats the document's own <h1> title as its <h2>, so it's suppressed — only a multi-section (dashboard) export needs each section separately labeled. */
function buildReportHtml(documentTitle: string, sections: ReportSection[]): string {
  const showSectionTitles = sections.length > 1;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 0; padding: 0 32px; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 0 0 10px; color: #333; border-bottom: 2px solid #2a78d6; padding-bottom: 4px; }
  section { margin-top: 20px; }
  .report-section-break { page-break-before: always; margin-top: 0; padding-top: 20px; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; } /* repeats on every page a table spans */
  th, td { border: 1px solid #ddd; padding: 5px 9px; font-size: 11px; text-align: left; }
  th { background: #eef3fb; color: #1a1a1a; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f7f7f6; }
</style>
</head>
<body>
  <h1>${escapeHtml(documentTitle)}</h1>
  ${sections.map((section, i) => buildSectionHtml(section, i === 0, showSectionTitles)).join('\n')}
</body>
</html>`;
}

@Injectable()
export class ReportPdfRendererService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly reportSettings: ReportSettingsService,
    private readonly uploadsService: UploadsService,
  ) {}

  /** Single-view export — one section, one document. */
  async renderTable(title: string, headers: string[], rows: Record<string, unknown>[]): Promise<Buffer> {
    return this.renderSections(title, [{ title, headers, rows }]);
  }

  /** Dashboard export — every tile's view becomes its own section, each starting on a fresh page, sharing one header/footer across the whole document. */
  async renderSections(documentTitle: string, sections: ReportSection[]): Promise<Buffer> {
    const html = buildReportHtml(documentTitle, sections);
    const { headerTemplate, footerTemplate } = await this.buildHeaderFooter();
    return renderHtmlToPdf(html, headerTemplate, footerTemplate);
  }

  /**
   * Builds the two small HTML snippets Chromium stamps on every page (separate render context
   * from the main document — `pageNumber`/`totalPages`/`date` are Chromium's own recognized
   * classes, filled in automatically). The logo is inlined as a base64 data URI rather than
   * referenced by URL: the header/footer templates render in an isolated context with no
   * guaranteed network path back to this app, so a remote image reference is fragile in a way an
   * inlined one isn't.
   */
  private async buildHeaderFooter(): Promise<{ headerTemplate: string; footerTemplate: string }> {
    const settings = await this.reportSettings.get();
    const appearance: { title: string | null; logo_file_id: string | null } | undefined = await this.knex('appearance_settings')
      .where({ id: 'singleton' })
      .first();

    const title = escapeHtml(settings.headerTitle || appearance?.title || 'TIBO');
    const subtitle = settings.headerSubtitle ? `<div style="font-size: 8px; color: #666;">${escapeHtml(settings.headerSubtitle)}</div>` : '';

    let logoImg = '';
    if (settings.showLogo && appearance?.logo_file_id) {
      try {
        const file = await this.uploadsService.read(appearance.logo_file_id);
        const dataUri = `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
        logoImg = `<img src="${dataUri}" style="height: 20px; margin-right: 8px;" />`;
      } catch {
        // Logo file missing/unreadable — the header still works without it, just text-only.
      }
    }

    const headerTemplate = `
      <div style="width: 100%; font-size: 10px; padding: 0 32px; display: flex; align-items: center; color: #1a1a1a;">
        ${logoImg}
        <div>
          <div style="font-weight: 600;">${title}</div>
          ${subtitle}
        </div>
      </div>`;

    const dateSlot = settings.showExportDate ? '<span class="date"></span>' : '';
    const pageSlot = settings.showPageNumbers ? 'Page <span class="pageNumber"></span> / <span class="totalPages"></span>' : '';
    const footerTemplate =
      dateSlot || pageSlot
        ? `<div style="width: 100%; font-size: 9px; padding: 0 32px; display: flex; justify-content: space-between; color: #666;">
            <span>${dateSlot}</span>
            <span>${pageSlot}</span>
          </div>`
        : '<span></span>'; // Puppeteer requires a non-empty string even when nothing is shown

    return { headerTemplate, footerTemplate };
  }
}

async function renderHtmlToPdf(html: string, headerTemplate: string, footerTemplate: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      // Margins must clear the stamped header/footer height, or Chromium overlaps them with the content.
      margin: { top: '70px', bottom: '50px', left: '20px', right: '20px' },
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
