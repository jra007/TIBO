import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { decryptSecret, encryptSecret } from '../../../common/encryption';

export interface SmtpSettings {
  host: string;
  port: number | null;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  fromAddress: string;
  requireTLS: boolean;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number | null;
  greetingTimeoutMs: number | null;
  socketTimeoutMs: number | null;
}

/** password?: omit = leave unchanged, '' = clear, value = replace. Never round-tripped in read responses. */
export interface UpdateSmtpSettingsInput {
  host: string;
  port: number | null;
  secure: boolean;
  username: string | null;
  password?: string;
  fromAddress: string;
  requireTLS: boolean;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number | null;
  greetingTimeoutMs: number | null;
  socketTimeoutMs: number | null;
}

interface SmtpSettingsRow {
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  password: string | null;
  from_address: string | null;
  require_tls: boolean;
  tls_reject_unauthorized: boolean;
  connect_timeout_ms: number | null;
  greeting_timeout_ms: number | null;
  socket_timeout_ms: number | null;
}

function toDomain(row: SmtpSettingsRow): SmtpSettings {
  return {
    host: row.host ?? '',
    port: row.port,
    secure: row.secure,
    username: row.username,
    hasPassword: Boolean(row.password),
    fromAddress: row.from_address ?? '',
    requireTLS: row.require_tls,
    tlsRejectUnauthorized: row.tls_reject_unauthorized,
    connectTimeoutMs: row.connect_timeout_ms,
    greetingTimeoutMs: row.greeting_timeout_ms,
    socketTimeoutMs: row.socket_timeout_ms,
  };
}

@Injectable()
export class SmtpSettingsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async get(): Promise<SmtpSettings> {
    const row: SmtpSettingsRow = await this.knex('smtp_settings').where({ id: 'singleton' }).first();
    return toDomain(row);
  }

  /** Used by SmtpMailerService to build a real nodemailer transport — includes the decrypted password. */
  async getWithSecret(): Promise<SmtpSettings & { password: string | null }> {
    const row: SmtpSettingsRow = await this.knex('smtp_settings').where({ id: 'singleton' }).first();
    return { ...toDomain(row), password: decryptSecret(row.password) };
  }

  async update(settings: UpdateSmtpSettingsInput, actorUserId: string): Promise<SmtpSettings> {
    const update: Record<string, unknown> = {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      from_address: settings.fromAddress,
      require_tls: settings.requireTLS,
      tls_reject_unauthorized: settings.tlsRejectUnauthorized,
      connect_timeout_ms: settings.connectTimeoutMs,
      greeting_timeout_ms: settings.greetingTimeoutMs,
      socket_timeout_ms: settings.socketTimeoutMs,
      updated_by: actorUserId,
      updated_at: new Date(),
    };
    // omit = leave unchanged; '' = clear; anything else = replace (encrypted)
    if (settings.password !== undefined) update.password = settings.password === '' ? null : encryptSecret(settings.password);

    await this.knex('smtp_settings').where({ id: 'singleton' }).update(update);
    return this.get();
  }
}
