import { Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RelationsService } from '../relations/relations.service';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly relationsService: RelationsService,
  ) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    const imports = await Promise.all(files.map((file) => this.ingestionService.ingestFile(file.originalname, file.buffer)));
    const importedTables = imports.filter((r) => r.status === 'success').map((r) => r.tableName);
    const relations = importedTables.length > 0 ? await this.relationsService.detectRelations() : [];
    return { imports, relations };
  }
}
