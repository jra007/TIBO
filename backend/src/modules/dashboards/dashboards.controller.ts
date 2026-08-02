import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import type { DashboardLayout, DashboardTileSize } from './dashboards.service';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Req() req: AuthenticatedRequest, @Body() body: { name: string; viewIds: string[]; layout?: DashboardLayout; cardSize?: DashboardTileSize }) {
    return this.dashboardsService.create(req.user.id, body.name, body.viewIds, body.layout, body.cardSize);
  }

  @Put(':id')
  @RequirePermission('view:create')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string; viewIds: string[]; layout?: DashboardLayout; cardSize?: DashboardTileSize },
  ) {
    return this.dashboardsService.update(id, req.user.id, body.name, body.viewIds, body.layout, body.cardSize);
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
  share(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body('groupId') groupId: string) {
    return this.dashboardsService.shareWithGroup(id, req.user.id, groupId);
  }

  @Post(':id/unshare')
  @RequirePermission('view:share')
  unshare(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.dashboardsService.unshare(id, req.user.id);
  }

  @Delete(':id')
  @RequirePermission('view:create')
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.dashboardsService.delete(id, req.user.id);
  }

  @Post(':id/reorder')
  @RequirePermission('view:create')
  reorder(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body('direction') direction: 'up' | 'down') {
    return this.dashboardsService.reorder(id, req.user.id, direction);
  }
}
