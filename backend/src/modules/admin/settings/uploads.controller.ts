import { Controller, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { Public } from '../../auth/decorators/public.decorator';
import { UploadsService } from './uploads.service';

/** Generic file storage — any authenticated user can upload, reused today by the appearance module for logo/favicon. */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    return this.uploadsService.save(file, req.user.id);
  }

  /** No auth: <img src>/<link rel="icon"> tags need this to work without a bearer token — the unguessable UUID is the access control. */
  @Public()
  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const file = await this.uploadsService.read(id);
    res
      .set({
        'Content-Type': file.mimeType,
        'Content-Disposition': `${file.disposition}; filename="${file.originalName}"`,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(file.buffer);
  }
}
