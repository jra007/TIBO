import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import type { Permission } from '../rbac/permissions';
import {
  AuthSettingsService,
  type UpdateAuthSettingsInput,
} from './settings/auth-settings.service';
import { DataResetService } from './settings/data-reset.service';
import { GroupsService } from './settings/groups.service';
import { LdapAuthProvider } from './settings/ldap-auth.provider';
import { ProjectsService } from './settings/projects.service';
import {
  RetentionSettingsService,
  type RetentionPolicy,
} from './settings/retention-settings.service';
import { RolesService } from './settings/roles.service';
import { SmtpMailerService } from './settings/smtp-mailer.service';
import {
  SmtpSettingsService,
  type UpdateSmtpSettingsInput,
} from './settings/smtp-settings.service';
import { UsersService } from './settings/users.service';

@Controller('admin/settings')
@RequirePermission('settings:access')
export class AdminController {
  constructor(
    private readonly retentionSettings: RetentionSettingsService,
    private readonly authSettings: AuthSettingsService,
    private readonly ldapAuthProvider: LdapAuthProvider,
    private readonly smtpSettings: SmtpSettingsService,
    private readonly smtpMailer: SmtpMailerService,
    private readonly groupsService: GroupsService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly dataResetService: DataResetService,
    private readonly projectsService: ProjectsService,
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
    @Body()
    body: {
      duration: number;
      unit: RetentionPolicy['unit'];
      status: RetentionPolicy['status'];
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.retentionSettings.update(dataType, body, req.user.id);
  }

  @Get('auth')
  getAuthSettings() {
    return this.authSettings.get();
  }

  @Put('auth')
  updateAuthSettings(
    @Body() body: UpdateAuthSettingsInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authSettings.update(body, req.user.id);
  }

  @Post('auth/ldap/test')
  testLdapConnection(
    @Body() body: { testUsername?: string; testPassword?: string },
  ) {
    return this.ldapAuthProvider.testConnection(
      body.testUsername,
      body.testPassword,
    );
  }

  @Get('smtp')
  getSmtpSettings() {
    return this.smtpSettings.get();
  }

  @Put('smtp')
  updateSmtpSettings(
    @Body() body: UpdateSmtpSettingsInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.smtpSettings.update(body, req.user.id);
  }

  @Post('smtp/test')
  sendSmtpTestEmail(@Body('to') to: string) {
    return this.smtpMailer.sendTestEmail(to);
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
  addGroupMember(
    @Param('groupId') groupId: string,
    @Body('userId') userId: string,
  ) {
    return this.groupsService.addMember(groupId, userId);
  }

  @Post('groups/:groupId/roles')
  @RequirePermission('settings:rbac:edit')
  assignRoleToGroup(
    @Param('groupId') groupId: string,
    @Body('roleId') roleId: string,
  ) {
    return this.groupsService.assignRole(groupId, roleId);
  }

  /** No extra @RequirePermission beyond the class-level settings:access — same as auth/smtp settings, not tied to RBAC administration specifically. */
  @Get('projects')
  listProjects() {
    return this.projectsService.list();
  }

  @Post('projects')
  createProject(@Body() body: { name: string; description: string }) {
    return this.projectsService.create(body.name, body.description);
  }

  @Get('roles')
  @RequirePermission('settings:rbac:edit')
  listRoles() {
    return this.rolesService.list();
  }

  @Post('roles')
  @RequirePermission('settings:rbac:edit')
  createRole(
    @Body()
    body: {
      name: string;
      description?: string;
      permissions: Permission[];
    },
  ) {
    return this.rolesService.create(
      body.name,
      body.description,
      body.permissions,
    );
  }

  @Post('roles/:roleId/users/:userId')
  @RequirePermission('settings:rbac:edit')
  assignRoleToUser(
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.assignToUser(roleId, userId);
  }

  /** Full data reset — wipes all ingested business data, keeps users/roles/settings/audit_log. Requires a typed confirmation phrase. */
  @Post('reset')
  @RequirePermission('settings:reset:execute')
  resetAllData(
    @Body('confirmation') confirmation: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dataResetService.resetAll(req.user.id, confirmation);
  }
}
