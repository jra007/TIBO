import { Injectable } from '@nestjs/common';

export interface Group {
  id: string;
  name: string;
  description: string;
}

@Injectable()
export class GroupsService {
  async create(name: string, description: string): Promise<Group> {
    void name;
    void description;
    throw new Error('Not implemented');
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    void groupId;
    void userId;
    throw new Error('Not implemented');
  }

  async assignRole(groupId: string, roleId: string): Promise<void> {
    void groupId;
    void roleId;
    throw new Error('Not implemented');
  }
}
