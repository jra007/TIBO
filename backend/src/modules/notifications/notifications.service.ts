import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import type { NotificationMessage, NotificationProvider } from './providers/notification-provider.interface';

@Injectable()
export class NotificationsService {
  constructor(@Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider) {}

  notify(message: NotificationMessage) {
    return this.provider.send(message);
  }
}
