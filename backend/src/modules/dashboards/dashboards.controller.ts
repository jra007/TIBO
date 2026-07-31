import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Body() body: { ownerId: string; name: string; viewIds: string[]; layout?: unknown }) {
    return this.dashboardsService.create(body.ownerId, body.name, body.viewIds, body.layout);
  }

  @Get('mine')
  @RequirePermission('view:read')
  listMine(@Query('ownerId') ownerId: string) {
    return this.dashboardsService.listMine(ownerId);
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
