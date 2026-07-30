import { Injectable } from '@nestjs/common';
import { AuthenticatedIdentity, AuthProvider } from './auth-provider.interface';

/**
 * Phase 2 — not wired into AuthModule yet. Config screen exists in the MVP
 * settings menu (see admin/settings) but this provider stays inactive until phase 2 ships.
 */
@Injectable()
export class LdapAuthProvider implements AuthProvider {
  readonly kind = 'ldap' as const;

  async authenticate(username: string, password: string): Promise<AuthenticatedIdentity | null> {
    void username;
    void password;
    throw new Error('Phase 2: LDAP authentication not yet active');
  }
}
