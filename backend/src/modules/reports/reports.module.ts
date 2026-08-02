import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ReportPdfRendererService } from './report-pdf-renderer.service';
import { ReportSettingsController } from './report-settings.controller';
import { ReportSettingsService } from './report-settings.service';

/** Owns the "Rapport" branding concern: the customizable PDF header/footer (logo, title,
 * subtitle, page numbers, export date) and the styled document renderer that applies it —
 * separate from ExportsModule, which owns *what data* goes into an export. */
@Module({
  imports: [AdminModule],
  controllers: [ReportSettingsController],
  providers: [ReportSettingsService, ReportPdfRendererService],
  exports: [ReportSettingsService, ReportPdfRendererService],
})
export class ReportsModule {}
