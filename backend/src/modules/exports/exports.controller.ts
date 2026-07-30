import { Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('pdf/:id')
  @RequirePermission('export:pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportsService.exportToPdf(id);
    res.set({ 'Content-Type': 'application/pdf' }).send(buffer);
  }

  @Post('excel/:id')
  @RequirePermission('export:excel')
  async excel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportsService.exportToExcel(id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }).send(buffer);
  }
}
