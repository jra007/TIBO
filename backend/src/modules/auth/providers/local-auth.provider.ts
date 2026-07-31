import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { verifyPassword } from '../password';
import { AuthenticatedIdentity, AuthProvider } from './auth-provider.interface';

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  readonly kind = 'local' as const;

  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async authenticate(username: string, password: string): Promise<AuthenticatedIdentity | null> {
    const user = await this.knex('users').where({ username, status: 'active' }).first();
    if (!user || !verifyPassword(password, user.password_hash)) return null;

    const groupIds: string[] = await this.knex('user_group').where({ user_id: user.id }).pluck('group_id');
    return { id: user.id, username: user.username, displayName: user.username, groupIds };
  }
}
