import { Inject, Injectable } from '@nestjs/common';
import { AUTH_PROVIDER } from './auth.constants';
import type { AuthProvider } from './providers/auth-provider.interface';

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_PROVIDER) private readonly provider: AuthProvider) {}

  login(username: string, password: string) {
    return this.provider.authenticate(username, password);
  }
}
