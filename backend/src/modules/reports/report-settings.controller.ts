import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ReportSettingsService, type UpdateReportSettingsInput } from './report-settings.service';

@Controller('admin/settings/reports')
export class ReportSettingsController {
  constructor(private readonly reportSettingsService: ReportSettingsService) {}

  @Get()
  @RequirePermission('settings:report:edit')
  get() {
    return this.reportSettingsService.get();
  }

  @Put()
  @RequirePermission('settings:report:edit')
  update(@Body() body: UpdateReportSettingsInput, @Req() req: AuthenticatedRequest) {
    return this.reportSettingsService.update(body, req.user.id);
  }
}
