import { Body, Controller, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { RelationsService } from './relations.service';

@Controller('relations')
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

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
