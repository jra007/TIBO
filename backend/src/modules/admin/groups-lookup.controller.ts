import { Controller, Get } from '@nestjs/common';
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
}
