import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';
import { RbacService } from '../rbac/rbac.service';
import { AUTH_PROVIDER, JWT_SECRET } from './auth.constants';
import { hashPassword, verifyPassword } from './password';
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

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
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

  /** Self-service: any authenticated local user can change their own password, regardless of RBAC role. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.knex('users').where({ id: userId }).first();
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.knex('users').where({ id: userId }).update({ password_hash: hashPassword(newPassword) });
  }
}
