import { Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    return Promise.all(files.map((file) => this.ingestionService.ingestFile(file.originalname, file.buffer)));
  }
}
