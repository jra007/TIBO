import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { GroupsService } from './settings/groups.service';

/**
 * Deliberately separate from AdminController: that controller's class-level
 * settings:access requirement would otherwise apply here too. Any authenticated user needs
 * to see group names to share a view/dashboard (view:share), not just RBAC admins.
 */
@Controller('groups')
export class GroupsLookupController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  list() {
    return this.groupsService.list();
  }

  /** Groups the caller actually belongs to — lets a page show "shared with my team" content automatically, without making the user pick a group first. */
  @Get('mine')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.groupsService.listForUser(req.user.id);
  }
}
