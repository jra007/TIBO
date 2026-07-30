import { Injectable } from '@nestjs/common';

export interface AuthSettings {
  activeMode: 'local' | 'ldap';
  ldap: {
    serverUrl: string;
    baseDn: string;
    attributeMapping: Record<string, string>;
  };
}

/**
 * Config screen exists from the MVP (see spec section 3.1.7), but switching activeMode to
 * 'ldap' has no effect until phase 2 wires LdapAuthProvider into AuthModule.
 */
@Injectable()
export class AuthSettingsService {
  async get(): Promise<AuthSettings> {
    throw new Error('Not implemented');
  }

  async update(settings: AuthSettings, actorUserId: string): Promise<AuthSettings> {
    void settings;
    void actorUserId;
    throw new Error('Not implemented');
  }
}
