import { Injectable } from '@nestjs/common';
import { NotificationMessage, NotificationProvider } from './notification-provider.interface';

/**
 * Phase 2 — not wired into NotificationsModule yet. Config screen exists in the MVP
 * settings menu (see admin/settings) but this provider stays inactive until phase 2 ships.
 */
@Injectable()
export class SmtpNotificationProvider implements NotificationProvider {
  readonly kind = 'smtp' as const;

  async send(message: NotificationMessage): Promise<void> {
    void message;
    throw new Error('Phase 2: SMTP notifications not yet active');
  }
}
