import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { NotificationMessage, NotificationProvider } from './notification-provider.interface';

/**
 * Default MVP provider: persists in-app notifications only, no SMTP.
 * "noop" refers to the absence of an outbound channel (email), not to the effect —
 * the notification is really stored and readable via GET /notifications.
 */
@Injectable()
export class NoopNotificationProvider implements NotificationProvider {
  readonly kind = 'noop' as const;

  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async send(message: NotificationMessage): Promise<void> {
    await this.knex('notifications').insert({
      recipient_user_id: message.recipientUserId,
      subject: message.subject,
      body: message.body,
    });
  }
}
