import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { RelationsService, type RelationStatus } from './relations.service';

@Controller('relations')
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

  @Get()
  @RequirePermission('relation:validate')
  list(@Query('status') status?: RelationStatus) {
    return this.relationsService.list(status);
  }

  @Post('detect')
  @RequirePermission('relation:validate')
  detect(@Body('tables') tables?: string[]) {
    return this.relationsService.detectRelations(tables);
  }

  /** Bulk "declutter" — clears undecided candidates only, safe to re-detect afterward. */
  @Delete('proposed')
  @RequirePermission('relation:validate')
  deleteProposed(@Req() req: AuthenticatedRequest) {
    return this.relationsService.deleteProposed(req.user.id);
  }

  /** Bulk "wipe and restart" — clears every relation, including validated/rejected decisions. */
  @Delete('all')
  @RequirePermission('relation:validate')
  deleteAll(@Req() req: AuthenticatedRequest) {
    return this.relationsService.deleteAll(req.user.id);
  }

  @Post(':id/validate')
  @RequirePermission('relation:validate')
  validate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.relationsService.validate(id, req.user.id);
  }

  @Post(':id/reject')
  @RequirePermission('relation:validate')
  reject(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.relationsService.reject(id, req.user.id);
  }
}
