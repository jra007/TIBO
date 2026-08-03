import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ColumnProfilerService } from './column-profiler.service';
import { RelationsService, type RelationStatus } from './relations.service';

@Controller('relations')
export class RelationsController {
  constructor(
    private readonly relationsService: RelationsService,
    private readonly columnProfiler: ColumnProfilerService,
  ) {}

  @Get()
  @RequirePermission('relation:validate')
  list(@Query('status') status?: RelationStatus) {
    return this.relationsService.list(status);
  }

  /** `tables` (explicit list) wins if given; otherwise `projectId` scopes to that project's own +
   * shared tables — omitting both falls back to every table, same as before projects existed. */
  @Post('detect')
  @RequirePermission('relation:validate')
  async detect(
    @Body('tables') tables?: string[],
    @Body('projectId') projectId?: string,
  ) {
    const scoped =
      tables ??
      (projectId
        ? await this.columnProfiler.listSourceTables(projectId)
        : undefined);
    return this.relationsService.detectRelations(scoped);
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
