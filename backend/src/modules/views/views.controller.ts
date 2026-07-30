import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { SavedView, ViewsService } from './views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Post()
  @RequirePermission('view:create')
  create(@Req() req: { user: { id: string } }, @Body() definition: Parameters<ViewsService['create']>[1]) {
    return this.viewsService.create(req.user.id, definition);
  }

  @Post(':id/share')
  @RequirePermission('view:share')
  share(@Param('id') id: string, @Body('groupId') groupId: string): Promise<SavedView> {
    return this.viewsService.shareWithGroup(id, groupId);
  }
}
