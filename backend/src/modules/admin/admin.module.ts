import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthSettingsService } from './settings/auth-settings.service';
import { GroupsService } from './settings/groups.service';
import { RetentionSettingsService } from './settings/retention-settings.service';
import { RolesService } from './settings/roles.service';
import { SmtpSettingsService } from './settings/smtp-settings.service';
import { UsersService } from './settings/users.service';

@Module({
  controllers: [AdminController],
  providers: [RetentionSettingsService, AuthSettingsService, SmtpSettingsService, GroupsService, RolesService, UsersService],
  exports: [RetentionSettingsService, AuthSettingsService, SmtpSettingsService, GroupsService, RolesService, UsersService],
})
export class AdminModule {}
