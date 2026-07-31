import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ViewsService, type CreateViewInput } from './views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateViewInput) {
    return this.viewsService.create(req.user.id, input);
  }

  @Get('mine')
  @RequirePermission('view:read')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.viewsService.listMine(req.user.id);
  }

  @Get('team/:groupId')
  @RequirePermission('view:read')
  listTeam(@Param('groupId') groupId: string) {
    return this.viewsService.listTeamWorkspace(groupId);
  }

  @Get(':id')
  @RequirePermission('view:read')
  getById(@Param('id') id: string) {
    return this.viewsService.getById(id);
  }

  @Put(':id')
  @RequirePermission('view:create')
  update(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body() input: CreateViewInput) {
    return this.viewsService.update(id, req.user.id, input);
  }

  @Get(':id/data')
  @RequirePermission('view:read')
  getData(@Param('id') id: string) {
    return this.viewsService.getData(id);
  }

  @Post(':id/share')
  @RequirePermission('view:share')
  share(@Param('id') id: string, @Body('groupId') groupId: string) {
    return this.viewsService.shareWithGroup(id, groupId);
  }
}
