import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthSettingsService } from './settings/auth-settings.service';
import { GroupsService } from './settings/groups.service';
import { RetentionSettingsService } from './settings/retention-settings.service';
import { SmtpSettingsService } from './settings/smtp-settings.service';

@Module({
  controllers: [AdminController],
  providers: [RetentionSettingsService, AuthSettingsService, SmtpSettingsService, GroupsService],
  exports: [RetentionSettingsService, AuthSettingsService, SmtpSettingsService, GroupsService],
})
export class AdminModule {}
