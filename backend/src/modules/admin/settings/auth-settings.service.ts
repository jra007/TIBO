import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

export interface AuthSettings {
  activeMode: 'local' | 'ldap';
  ldap: {
    serverUrl: string;
    baseDn: string;
    attributeMapping: Record<string, string>;
  };
}

/**
 * Config screen exists from the MVP (see spec section 3.1.7) and is fully persisted here, but
 * switching activeMode to 'ldap' has no effect — AuthModule still hard-wires LocalAuthProvider
 * until phase 2 actually wires LdapAuthProvider in.
 */
@Injectable()
export class AuthSettingsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async get(): Promise<AuthSettings> {
    const row = await this.knex('auth_settings').where({ id: 'singleton' }).first();
    return {
      activeMode: row.active_mode,
      ldap: {
        serverUrl: row.ldap_server_url ?? '',
        baseDn: row.ldap_base_dn ?? '',
        attributeMapping: row.ldap_attribute_mapping ?? {},
      },
    };
  }

  async update(settings: AuthSettings, actorUserId: string): Promise<AuthSettings> {
    await this.knex('auth_settings').where({ id: 'singleton' }).update({
      active_mode: settings.activeMode,
      ldap_server_url: settings.ldap.serverUrl,
      ldap_base_dn: settings.ldap.baseDn,
      ldap_attribute_mapping: JSON.stringify(settings.ldap.attributeMapping),
      updated_by: actorUserId,
      updated_at: new Date(),
    });
    return this.get();
  }
}
