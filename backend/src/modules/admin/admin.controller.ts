import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import type { Permission } from '../rbac/permissions';
import { AuthSettingsService, type AuthSettings } from './settings/auth-settings.service';
import { GroupsService } from './settings/groups.service';
import { RetentionSettingsService, type RetentionPolicy } from './settings/retention-settings.service';
import { RolesService } from './settings/roles.service';
import { SmtpSettingsService, type SmtpSettings } from './settings/smtp-settings.service';
import { UsersService } from './settings/users.service';

@Controller('admin/settings')
@RequirePermission('settings:access')
export class AdminController {
  constructor(
    private readonly retentionSettings: RetentionSettingsService,
    private readonly authSettings: AuthSettingsService,
    private readonly smtpSettings: SmtpSettingsService,
    private readonly groupsService: GroupsService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
  ) {}

  @Get('retention')
  @RequirePermission('settings:retention:edit')
  listRetention() {
    return this.retentionSettings.list();
  }

  @Put('retention/:dataType')
  @RequirePermission('settings:retention:edit')
  updateRetention(
    @Param('dataType') dataType: string,
    @Body() body: { duration: number; unit: RetentionPolicy['unit']; status: RetentionPolicy['status'] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.retentionSettings.update(dataType, body, req.user.id);
  }

  @Get('auth')
  getAuthSettings() {
    return this.authSettings.get();
  }

  @Put('auth')
  updateAuthSettings(@Body() body: AuthSettings, @Req() req: AuthenticatedRequest) {
    return this.authSettings.update(body, req.user.id);
  }

  @Get('smtp')
  getSmtpSettings() {
    return this.smtpSettings.get();
  }

  @Put('smtp')
  updateSmtpSettings(@Body() body: SmtpSettings, @Req() req: AuthenticatedRequest) {
    return this.smtpSettings.update(body, req.user.id);
  }

  @Get('users')
  @RequirePermission('settings:rbac:edit')
  listUsers() {
    return this.usersService.list();
  }

  @Post('users')
  @RequirePermission('settings:rbac:edit')
  createUser(@Body() body: { username: string; password: string }) {
    return this.usersService.create(body.username, body.password);
  }

  @Get('groups')
  @RequirePermission('settings:rbac:edit')
  listGroups() {
    return this.groupsService.list();
  }

  @Post('groups')
  @RequirePermission('settings:rbac:edit')
  createGroup(@Body() body: { name: string; description: string }) {
    return this.groupsService.create(body.name, body.description);
  }

  @Post('groups/:groupId/members')
  @RequirePermission('settings:rbac:edit')
  addGroupMember(@Param('groupId') groupId: string, @Body('userId') userId: string) {
    return this.groupsService.addMember(groupId, userId);
  }

  @Post('groups/:groupId/roles')
  @RequirePermission('settings:rbac:edit')
  assignRoleToGroup(@Param('groupId') groupId: string, @Body('roleId') roleId: string) {
    return this.groupsService.assignRole(groupId, roleId);
  }

  @Get('roles')
  @RequirePermission('settings:rbac:edit')
  listRoles() {
    return this.rolesService.list();
  }

  @Post('roles')
  @RequirePermission('settings:rbac:edit')
  createRole(@Body() body: { name: string; description?: string; permissions: Permission[] }) {
    return this.rolesService.create(body.name, body.description, body.permissions);
  }

  @Post('roles/:roleId/users/:userId')
  @RequirePermission('settings:rbac:edit')
  assignRoleToUser(@Param('roleId') roleId: string, @Param('userId') userId: string) {
    return this.rolesService.assignToUser(roleId, userId);
  }
}
