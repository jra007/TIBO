import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { RbacService } from '../rbac/rbac.service';
import { AUTH_PROVIDER, JWT_SECRET } from './auth.constants';
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
}
