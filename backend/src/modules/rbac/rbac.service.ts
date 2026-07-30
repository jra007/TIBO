import { Injectable } from '@nestjs/common';
import { Permission } from './permissions';

@Injectable()
export class RbacService {
  async getPermissionsForUser(userId: string): Promise<Permission[]> {
    void userId;
    throw new Error('Not implemented: resolve permissions via user -> group -> role -> permission');
  }
}
