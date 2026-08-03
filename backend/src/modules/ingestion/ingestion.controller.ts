import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { ColumnProfilerService } from '../relations/column-profiler.service';
import { RelationsService } from '../relations/relations.service';
import { IngestionService } from './ingestion.service';
import type { CleaningCorrection } from './parsing';

@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly relationsService: RelationsService,
    private readonly columnProfiler: ColumnProfilerService,
  ) {}

  /**
   * Grid preview before anything is committed — the assisted-correction UI calls this once per
   * file before the real upload, to decide whether it needs to show a review step.
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    return this.ingestionService.previewFile(file.originalname, file.buffer);
  }

  /**
   * The real cleaned result a correction would produce, shown after the assisted-correction grid
   * and before the actual import — never touches the database (see IngestionService.previewCleanedFile).
   */
  @Post('preview-cleaned')
  @UseInterceptors(FileInterceptor('file'))
  previewCleaned(
    @UploadedFile() file: Express.Multer.File,
    @Body('correction') correctionJson: string | undefined,
  ) {
    const correction: CleaningCorrection | undefined = correctionJson
      ? JSON.parse(correctionJson)
      : undefined;
    return this.ingestionService.previewCleanedFile(
      file.originalname,
      file.buffer,
      correction,
    );
  }

  /**
   * `corrections` (optional) is a JSON-encoded map of file name -> CleaningCorrection, for files
   * the user just reviewed in the preview grid — see IngestionService.ingestFile for how a
   * provided correction is memorized for future imports of the same file name.
   *
   * `projectId` is a single choice for the whole batch (the upload UI is "select files, then
   * Importer" — no per-file project picker), only actually applied the first time each file's
   * table gets created (see IngestionService.loadIntoTable). Empty/omitted means "commun à tous
   * les projets" (is_shared:true) — there's no separate share flag, a specific project choice and
   * the shared default are mutually exclusive in the upload UI.
   */
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('corrections') correctionsJson: string | undefined,
    @Body('projectId') projectId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const corrections: Record<string, CleaningCorrection> = correctionsJson
      ? JSON.parse(correctionsJson)
      : {};
    const projectAssignment = projectId
      ? { projectId, isShared: false }
      : { projectId: null, isShared: true };
    const imports = await Promise.all(
      files.map((file) =>
        this.ingestionService.ingestFile(
          file.originalname,
          file.buffer,
          req.user.id,
          corrections[file.originalname],
          projectAssignment,
        ),
      ),
    );
    const importedTables = imports
      .filter((r) => r.status === 'success')
      .map((r) => r.tableName);
    // Scoped to this project's own tables + shared ones (or, for a "commun" upload with no
    // project, every table — a shared file needs to be relatable to any project that might use
    // it, so an unscoped scan is the correct behavior there too, not just a fallback). Without
    // this, two unrelated projects with similarly-named columns would start generating noisy
    // cross-project relation proposals the moment projects exist at all.
    const relations =
      importedTables.length > 0
        ? await this.relationsService.detectRelations(
            await this.columnProfiler.listSourceTables(
              projectAssignment.projectId ?? undefined,
            ),
          )
        : [];
    return { imports, relations };
  }

  /** Table+column listing (no profiling) for the view builder's field picker. `projectId`
   * narrows to that project's own tables + any shared table — omitted means every table. */
  @Get('tables')
  listTables(@Query('projectId') projectId?: string) {
    return this.columnProfiler.listTableSchemas(projectId);
  }

  /** Full ingestion history (all past imports, with dates), not just the current upload's result. */
  @Get('journal')
  listJournal() {
    return this.ingestionService.listJournal();
  }

  /** Default value for the global date selector — see IngestionService.getLatestIngestionDate. */
  @Get('latest-date')
  async getLatestIngestionDate() {
    return { date: await this.ingestionService.getLatestIngestionDate() };
  }

  /** Bulk-deletes selected journal entries (e.g. duplicate imports of the same file) — history cleanup only, see the service for why this never touches actual data. */
  @Delete('journal')
  @RequirePermission('ingestion:manage')
  deleteJournalEntries(
    @Body('ids') ids: string[],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ingestionService.deleteJournalEntries(ids, req.user.id);
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
    return this.ingestionService.setColumnLabel(
      tableName,
      columnName,
      label,
      req.user.id,
    );
  }
}
