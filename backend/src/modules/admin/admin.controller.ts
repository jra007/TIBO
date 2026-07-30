import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { AuthSettingsService } from './settings/auth-settings.service';
import { RetentionSettingsService } from './settings/retention-settings.service';
import { SmtpSettingsService } from './settings/smtp-settings.service';

@Controller('admin/settings')
@UseGuards(PermissionsGuard)
@RequirePermission('settings:access')
export class AdminController {
  constructor(
    private readonly retentionSettings: RetentionSettingsService,
    private readonly authSettings: AuthSettingsService,
    private readonly smtpSettings: SmtpSettingsService,
  ) {}

  @Put('retention/:dataType')
  @RequirePermission('settings:retention:edit')
  updateRetention(@Param('dataType') dataType: string, @Body() body: { duration: number; unit: string; actorUserId: string }) {
    return this.retentionSettings.update(dataType, body as never, body.actorUserId);
  }

  @Get('auth')
  getAuthSettings() {
    return this.authSettings.get();
  }

  @Get('smtp')
  getSmtpSettings() {
    return this.smtpSettings.get();
  }
}
