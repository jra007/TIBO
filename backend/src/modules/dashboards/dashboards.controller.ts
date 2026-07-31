import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Req() req: AuthenticatedRequest, @Body() body: { name: string; viewIds: string[]; layout?: unknown }) {
    return this.dashboardsService.create(req.user.id, body.name, body.viewIds, body.layout);
  }

  @Get('mine')
  @RequirePermission('view:read')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.dashboardsService.listMine(req.user.id);
  }

  @Get('team/:groupId')
  @RequirePermission('view:read')
  listTeam(@Param('groupId') groupId: string) {
    return this.dashboardsService.listTeamWorkspace(groupId);
  }

  @Get(':id')
  @RequirePermission('view:read')
  getById(@Param('id') id: string) {
    return this.dashboardsService.getById(id);
  }

  @Post(':id/share')
  @RequirePermission('view:share')
  share(@Param('id') id: string, @Body('groupId') groupId: string) {
    return this.dashboardsService.shareWithGroup(id, groupId);
  }
}
