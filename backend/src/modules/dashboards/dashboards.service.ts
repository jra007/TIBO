import { Injectable } from '@nestjs/common';
import { ViewVisibility } from '../views/views.service';

export interface Dashboard {
  id: string;
  ownerId: string;
  name: string;
  viewIds: string[];
  layout: unknown;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
}

@Injectable()
export class DashboardsService {
  async create(ownerId: string, name: string, viewIds: string[], layout: unknown): Promise<Dashboard> {
    void ownerId;
    void name;
    void viewIds;
    void layout;
    throw new Error('Not implemented: same visibility/sharing rules as views.service');
  }
}
