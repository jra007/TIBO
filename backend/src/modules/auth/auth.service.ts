import { randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { AuthSettingsService } from '../admin/settings/auth-settings.service';
import { RbacService } from '../rbac/rbac.service';
import { AUTH_PROVIDER, JWT_SECRET } from './auth.constants';
import { hashPassword, verifyPassword } from './password';
import { LdapAuthProvider } from '../admin/settings/ldap-auth.provider';
import type { AuthProvider } from './providers/auth-provider.interface';

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    permissions: string[];
  };
}

export interface AuthMethodsStatus {
  local: true;
  ldap: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly ldapAuthProvider: LdapAuthProvider,
    private readonly authSettings: AuthSettingsService,
    private readonly rbacService: RbacService,
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
  ) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    const identity = await this.provider.authenticate(username, password);
    if (!identity) throw new UnauthorizedException('Identifiants invalides');

    const permissions = await this.rbacService.getPermissionsForUser(identity.id);
    const token = jwt.sign({ sub: identity.id, username: identity.username }, JWT_SECRET, { expiresIn: '12h' });

    return {
      token,
      user: { id: identity.id, username: identity.username, displayName: identity.displayName, permissions },
    };
  }

  /**
   * Auto-provisions a local shadow account on first successful LDAP login (status active,
   * an unusable random password hash so local login can never succeed for it), and refuses to
   * let LDAP take over a username that already has a real local account (auth_provider='local').
   */
  async loginWithLdap(username: string, password: string): Promise<LoginResponse> {
    const resolvedUsername = await this.ldapAuthProvider.verifyCredentials(username, password);
    if (!resolvedUsername) throw new UnauthorizedException('Identifiants invalides');

    let user = await this.knex('users').where({ username: resolvedUsername }).first();
    if (user && user.auth_provider === 'local') {
      throw new ForbiddenException('Un compte local existe déjà avec cet identifiant.');
    }

    if (!user) {
      const [created] = await this.knex('users')
        .insert({
          username: resolvedUsername,
          password_hash: hashPassword(randomBytes(32).toString('hex')),
          status: 'active',
          auth_provider: 'ldap',
        })
        .returning('*');
      user = created;
    }
    if (user.status !== 'active') throw new UnauthorizedException('Compte désactivé');

    const permissions = await this.rbacService.getPermissionsForUser(user.id);
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });

    return {
      token,
      user: { id: user.id, username: user.username, displayName: user.username, permissions },
    };
  }

  async getAuthMethods(): Promise<AuthMethodsStatus> {
    const settings = await this.authSettings.get();
    return { local: true, ldap: settings.ldap.enabled };
  }

  /** Self-service: any authenticated local user can change their own password, regardless of RBAC role. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.knex('users').where({ id: userId }).first();
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.knex('users').where({ id: userId }).update({ password_hash: hashPassword(newPassword) });
  }
}
