import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { decryptSecret, encryptSecret } from '../../../common/encryption';

export interface LdapSettings {
  enabled: boolean;
  url: string;
  bindDn: string;
  hasBindPassword: boolean;
  baseDn: string;
  searchFilter: string;
  usernameAttribute: string;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number | null;
  timeoutMs: number | null;
}

export interface AuthSettings {
  ldap: LdapSettings;
}

/** bindPassword?: omit = leave unchanged, '' = clear, value = replace. Never round-tripped in read responses. */
export interface UpdateAuthSettingsInput {
  ldap: {
    enabled: boolean;
    url: string;
    bindDn: string;
    bindPassword?: string;
    baseDn: string;
    searchFilter: string;
    usernameAttribute: string;
    tlsRejectUnauthorized: boolean;
    connectTimeoutMs: number | null;
    timeoutMs: number | null;
  };
}

interface AuthSettingsRow {
  ldap_enabled: boolean;
  ldap_url: string | null;
  ldap_bind_dn: string | null;
  ldap_bind_password: string | null;
  ldap_base_dn: string | null;
  ldap_search_filter: string | null;
  ldap_username_attribute: string;
  ldap_tls_reject_unauthorized: boolean;
  ldap_connect_timeout_ms: number | null;
  ldap_timeout_ms: number | null;
}

function toDomain(row: AuthSettingsRow): AuthSettings {
  return {
    ldap: {
      enabled: row.ldap_enabled,
      url: row.ldap_url ?? '',
      bindDn: row.ldap_bind_dn ?? '',
      hasBindPassword: Boolean(row.ldap_bind_password),
      baseDn: row.ldap_base_dn ?? '',
      searchFilter: row.ldap_search_filter ?? '',
      usernameAttribute: row.ldap_username_attribute,
      tlsRejectUnauthorized: row.ldap_tls_reject_unauthorized,
      connectTimeoutMs: row.ldap_connect_timeout_ms,
      timeoutMs: row.ldap_timeout_ms,
    },
  };
}

@Injectable()
export class AuthSettingsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async get(): Promise<AuthSettings> {
    const row: AuthSettingsRow = await this.knex('auth_settings').where({ id: 'singleton' }).first();
    return toDomain(row);
  }

  /** Used by LdapAuthProvider to build a real connection — includes the decrypted bind password. */
  async getLdapConfigWithSecret(): Promise<LdapSettings & { bindPassword: string | null }> {
    const row: AuthSettingsRow = await this.knex('auth_settings').where({ id: 'singleton' }).first();
    return { ...toDomain(row).ldap, bindPassword: decryptSecret(row.ldap_bind_password) };
  }

  async update(settings: UpdateAuthSettingsInput, actorUserId: string): Promise<AuthSettings> {
    const update: Record<string, unknown> = {
      ldap_enabled: settings.ldap.enabled,
      ldap_url: settings.ldap.url,
      ldap_bind_dn: settings.ldap.bindDn,
      ldap_base_dn: settings.ldap.baseDn,
      ldap_search_filter: settings.ldap.searchFilter,
      ldap_username_attribute: settings.ldap.usernameAttribute,
      ldap_tls_reject_unauthorized: settings.ldap.tlsRejectUnauthorized,
      ldap_connect_timeout_ms: settings.ldap.connectTimeoutMs,
      ldap_timeout_ms: settings.ldap.timeoutMs,
      updated_by: actorUserId,
      updated_at: new Date(),
    };
    if (settings.ldap.bindPassword !== undefined) {
      update.ldap_bind_password = settings.ldap.bindPassword === '' ? null : encryptSecret(settings.ldap.bindPassword);
    }

    await this.knex('auth_settings').where({ id: 'singleton' }).update(update);
    return this.get();
  }
}
