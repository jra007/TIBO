import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

/** Raster formats only — explicitly excludes image/svg+xml, which can carry <script> and would be stored XSS if served inline. */
const INLINE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/x-icon']);

export interface UploadedFileMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredFile extends UploadedFileMeta {
  buffer: Buffer;
  /** 'inline' for the safe raster allowlist, 'attachment' (forced download) for everything else. */
  disposition: 'inline' | 'attachment';
}

@Injectable()
export class UploadsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async save(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, uploadedByUserId: string): Promise<UploadedFileMeta> {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new BadRequestException('Fichier trop volumineux (15 Mo maximum)');

    const id = randomUUID();
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, id), file.buffer);
    await this.knex('uploaded_files').insert({
      id,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      uploaded_by: uploadedByUserId,
    });
    return { id, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
  }

  /** Unauthenticated by design (see controller) — the unguessable UUID is the access control, so the id shape is validated before it ever reaches the filesystem. */
  async read(id: string): Promise<StoredFile> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new NotFoundException('Fichier introuvable');
    }

    const row = await this.knex('uploaded_files').where({ id }).first();
    if (!row) throw new NotFoundException('Fichier introuvable');

    const buffer = await fs.readFile(path.join(UPLOAD_DIR, id));
    return {
      id: row.id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      buffer,
      disposition: INLINE_MIME_TYPES.has(row.mime_type) ? 'inline' : 'attachment',
    };
  }
}
