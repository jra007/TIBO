import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

export interface SmtpSettings {
  serverUrl: string;
  port: number;
  credentialsSecretRef: string;
  senderAddress: string;
}

/**
 * Config screen exists from the MVP and is fully persisted here, but is not wired into
 * NotificationsModule until phase 2 activates SmtpNotificationProvider. Credentials are a
 * reference into the secrets vault, never stored in clear.
 */
@Injectable()
export class SmtpSettingsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async get(): Promise<SmtpSettings> {
    const row = await this.knex('smtp_settings').where({ id: 'singleton' }).first();
    return {
      serverUrl: row.server_url ?? '',
      port: row.port ?? 0,
      credentialsSecretRef: row.credentials_secret_ref ?? '',
      senderAddress: row.sender_address ?? '',
    };
  }

  async update(settings: SmtpSettings, actorUserId: string): Promise<SmtpSettings> {
    await this.knex('smtp_settings').where({ id: 'singleton' }).update({
      server_url: settings.serverUrl,
      port: settings.port,
      credentials_secret_ref: settings.credentialsSecretRef,
      sender_address: settings.senderAddress,
      updated_by: actorUserId,
      updated_at: new Date(),
    });
    return this.get();
  }
}
