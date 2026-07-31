import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('pdf/:id')
  @RequirePermission('export:pdf')
  async pdf(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.exportsService.exportToPdf(id, req.user.id);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="export-${id}.pdf"`,
      })
      .send(buffer);
  }

  @Post('excel/:id')
  @RequirePermission('export:excel')
  async excel(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.exportsService.exportToExcel(id, req.user.id);
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export-${id}.xlsx"`,
      })
      .send(buffer);
  }
}
