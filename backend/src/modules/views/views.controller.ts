import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CreateViewInput, ViewsService } from './views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Body() body: CreateViewInput & { ownerId: string }) {
    const { ownerId, ...input } = body;
    return this.viewsService.create(ownerId, input);
  }

  @Get('mine')
  @RequirePermission('view:read')
  listMine(@Query('ownerId') ownerId: string) {
    return this.viewsService.listMine(ownerId);
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

  @Post(':id/share')
  @RequirePermission('view:share')
  share(@Param('id') id: string, @Body('groupId') groupId: string) {
    return this.viewsService.shareWithGroup(id, groupId);
  }
}
