import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { NotificationsService } from './notifications.service';
import { NoopNotificationProvider } from './providers/noop-notification.provider';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // Swap for SmtpNotificationProvider once phase 2 activates SMTP,
    // driven by the config in admin/settings (smtp-settings.service.ts).
    { provide: NOTIFICATION_PROVIDER, useClass: NoopNotificationProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
