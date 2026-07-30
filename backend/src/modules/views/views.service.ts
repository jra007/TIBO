import { Injectable } from '@nestjs/common';

export type ChartType = 'bar' | 'line' | 'scatter' | 'heatmap' | 'table' | 'geo';
export type ViewVisibility = 'private' | 'shared';
export type ViewRelationStatus = 'validated' | 'pending' | 'to_fix';

export interface ShelfDefinition {
  rows: string[];
  columns: string[];
  color?: string;
  size?: string;
  filters: string[];
}

export interface SavedView {
  id: string;
  ownerId: string;
  name: string;
  chartType: ChartType;
  shelves: ShelfDefinition;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  relationStatus: ViewRelationStatus;
}

@Injectable()
export class ViewsService {
  async create(ownerId: string, definition: Omit<SavedView, 'id' | 'ownerId' | 'visibility' | 'sharedWithGroupId'>): Promise<SavedView> {
    void ownerId;
    void definition;
    throw new Error('Not implemented: persist as private view, derive relationStatus from underlying relation');
  }

  /** Requires view:share in addition to view:create — kept as a distinct permission per spec. */
  async shareWithGroup(viewId: string, groupId: string): Promise<SavedView> {
    void viewId;
    void groupId;
    throw new Error('Not implemented: set visibility=shared, sharedWithGroupId, surface in team workspace');
  }
}
