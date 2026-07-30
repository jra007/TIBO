import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  validate(@Param('id') id: string, @Body('adminUserId') adminUserId: string) {
    return this.relationsService.validate(id, adminUserId);
  }

  @Post(':id/reject')
  @RequirePermission('relation:validate')
  reject(@Param('id') id: string, @Body('adminUserId') adminUserId: string) {
    return this.relationsService.reject(id, adminUserId);
  }
}
