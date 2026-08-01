import { Body, Controller, Get, Param, Post, Put, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ColumnProfilerService } from '../relations/column-profiler.service';
import { RelationsService } from '../relations/relations.service';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly relationsService: RelationsService,
    private readonly columnProfiler: ColumnProfilerService,
  ) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    const imports = await Promise.all(files.map((file) => this.ingestionService.ingestFile(file.originalname, file.buffer)));
    const importedTables = imports.filter((r) => r.status === 'success').map((r) => r.tableName);
    const relations = importedTables.length > 0 ? await this.relationsService.detectRelations() : [];
    return { imports, relations };
  }

  /** Table+column listing (no profiling) for the view builder's field picker. */
  @Get('tables')
  listTables() {
    return this.columnProfiler.listTableSchemas();
  }

  /** Full ingestion history (all past imports, with dates), not just the current upload's result. */
  @Get('journal')
  listJournal() {
    return this.ingestionService.listJournal();
  }

  /** Cosmetic display label for a column, for readability in the builder/charts/exports — doesn't rename the underlying data. */
  @Put('tables/:tableName/columns/:columnName/label')
  @RequirePermission('view:create')
  setColumnLabel(
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Body('label') label: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ingestionService.setColumnLabel(tableName, columnName, label, req.user.id);
  }
}
