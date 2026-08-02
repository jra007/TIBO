import { Controller, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { parseRuntimeFilters } from '../views/view-query-builder';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('pdf/:id')
  @RequirePermission('export:pdf')
  async pdf(
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @Query('filters') filters: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportToPdf(id, req.user.id, date, parseRuntimeFilters(filters));
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="export-${id}.pdf"`,
      })
      .send(buffer);
  }

  @Post('excel/:id')
  @RequirePermission('export:excel')
  async excel(
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @Query('filters') filters: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportToExcel(id, req.user.id, date, parseRuntimeFilters(filters));
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export-${id}.xlsx"`,
      })
      .send(buffer);
  }

  @Post('pdf/dashboard/:id')
  @RequirePermission('export:pdf')
  async pdfDashboard(@Param('id') id: string, @Query('date') date: string | undefined, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.exportsService.exportDashboardToPdf(id, req.user.id, date);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dashboard-${id}.pdf"`,
      })
      .send(buffer);
  }

  @Post('excel/dashboard/:id')
  @RequirePermission('export:excel')
  async excelDashboard(@Param('id') id: string, @Query('date') date: string | undefined, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.exportsService.exportDashboardToExcel(id, req.user.id, date);
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="dashboard-${id}.xlsx"`,
      })
      .send(buffer);
  }
}
