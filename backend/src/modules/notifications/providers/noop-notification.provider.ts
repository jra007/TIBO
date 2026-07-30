import { Injectable, Logger } from '@nestjs/common';
import { NotificationMessage, NotificationProvider } from './notification-provider.interface';

/**
 * Default MVP provider: in-app notifications only, no SMTP.
 * Logs so in-app events (relation rejected, view shared) stay visible until phase 2 wires SMTP in.
 */
@Injectable()
export class NoopNotificationProvider implements NotificationProvider {
  readonly kind = 'noop' as const;
  private readonly logger = new Logger(NoopNotificationProvider.name);

  async send(message: NotificationMessage): Promise<void> {
    this.logger.log(`[in-app only] to=${message.recipientUserId} subject="${message.subject}"`);
  }
}
