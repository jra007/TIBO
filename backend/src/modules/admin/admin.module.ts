import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { GroupsLookupController } from './groups-lookup.controller';
import { AppearanceController } from './settings/appearance.controller';
import { AppearanceService } from './settings/appearance.service';
import { AuthSettingsService } from './settings/auth-settings.service';
import { DataResetService } from './settings/data-reset.service';
import { GroupsService } from './settings/groups.service';
import { LdapAuthProvider } from './settings/ldap-auth.provider';
import { RetentionSettingsService } from './settings/retention-settings.service';
import { RolesService } from './settings/roles.service';
import { SmtpMailerService } from './settings/smtp-mailer.service';
import { SmtpSettingsService } from './settings/smtp-settings.service';
import { UploadsController } from './settings/uploads.controller';
import { UploadsService } from './settings/uploads.service';
import { UsersService } from './settings/users.service';

@Module({
  controllers: [AdminController, GroupsLookupController, AppearanceController, UploadsController],
  providers: [
    RetentionSettingsService,
    AuthSettingsService,
    LdapAuthProvider,
    SmtpSettingsService,
    SmtpMailerService,
    GroupsService,
    RolesService,
    UsersService,
    DataResetService,
    UploadsService,
    AppearanceService,
  ],
  exports: [
    RetentionSettingsService,
    AuthSettingsService,
    LdapAuthProvider,
    SmtpSettingsService,
    GroupsService,
    RolesService,
    UsersService,
    DataResetService,
    UploadsService,
  ],
})
export class AdminModule {}
