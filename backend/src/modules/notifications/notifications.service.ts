import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import type { NotificationMessage, NotificationProvider } from './providers/notification-provider.interface';

export interface StoredNotification {
  id: string;
  recipientUserId: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
  ) {}

  notify(message: NotificationMessage) {
    return this.provider.send(message);
  }

  async listFor(recipientUserId: string): Promise<StoredNotification[]> {
    const rows = await this.knex('notifications').where({ recipient_user_id: recipientUserId }).orderBy('created_at', 'desc');
    return rows.map((row) => ({
      id: row.id,
      recipientUserId: row.recipient_user_id,
      subject: row.subject,
      body: row.body,
      read: row.read,
      createdAt: row.created_at,
    }));
  }

  async markRead(notificationId: string): Promise<void> {
    await this.knex('notifications').where({ id: notificationId }).update({ read: true });
  }
}
