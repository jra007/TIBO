import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
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
