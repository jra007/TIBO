import { Injectable } from '@nestjs/common';

@Injectable()
export class ExportsService {
  /** Renders HTML -> PDF (Puppeteer/Playwright). Result must be purged 1h after generation per retention policy. */
  async exportToPdf(viewOrDashboardId: string): Promise<Buffer> {
    void viewOrDashboardId;
    throw new Error('Not implemented');
  }

  /** SheetJS-based export of underlying data, headers + types preserved. */
  async exportToExcel(viewId: string): Promise<Buffer> {
    void viewId;
    throw new Error('Not implemented');
  }
}
