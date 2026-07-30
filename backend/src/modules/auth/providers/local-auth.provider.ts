import { Injectable } from '@nestjs/common';
import { AuthenticatedIdentity, AuthProvider } from './auth-provider.interface';

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  readonly kind = 'local' as const;

  async authenticate(username: string, password: string): Promise<AuthenticatedIdentity | null> {
    void username;
    void password;
    throw new Error('Not implemented: wire up local account lookup + argon2 verification');
  }
}
