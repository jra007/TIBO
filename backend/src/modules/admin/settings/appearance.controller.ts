import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { Public } from '../../auth/decorators/public.decorator';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { AppearanceService, type UpdateAppearanceSettingsInput } from './appearance.service';

/** Separate from AdminController on purpose: GET must be reachable with zero auth (login/register branding), unlike the rest of admin/settings. */
@Controller('appearance')
export class AppearanceController {
  constructor(private readonly appearanceService: AppearanceService) {}

  @Public()
  @Get()
  get() {
    return this.appearanceService.get();
  }

  @Put()
  @RequirePermission('settings:appearance:edit')
  update(@Body() body: UpdateAppearanceSettingsInput, @Req() req: AuthenticatedRequest) {
    return this.appearanceService.update(body, req.user.id);
  }
}
