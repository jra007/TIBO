import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';
import { hashPassword } from '../../auth/password';

export interface User {
  id: string;
  username: string;
  status: 'active' | 'inactive';
}

@Injectable()
export class UsersService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(username: string, password: string): Promise<User> {
    const [row] = await this.knex('users')
      .insert({ username, password_hash: hashPassword(password), status: 'active' })
      .returning(['id', 'username', 'status']);
    return row;
  }

  async list(): Promise<User[]> {
    return this.knex('users').select('id', 'username', 'status').orderBy('username');
  }
}
