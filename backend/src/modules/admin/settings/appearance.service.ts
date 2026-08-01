import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../../database/database.constants';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface AppearanceSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  title: string | null;
  primaryColor: string | null;
  backgroundColor: string | null;
}

/** Any field omitted = unchanged; explicit null = reset to default. logoFileId/faviconFileId must reference an already-uploaded file (see UploadsService). */
export interface UpdateAppearanceSettingsInput {
  logoFileId?: string | null;
  faviconFileId?: string | null;
  title?: string | null;
  primaryColor?: string | null;
  backgroundColor?: string | null;
}

interface AppearanceSettingsRow {
  logo_file_id: string | null;
  favicon_file_id: string | null;
  title: string | null;
  primary_color: string | null;
  background_color: string | null;
}

function toDomain(row: AppearanceSettingsRow): AppearanceSettings {
  return {
    logoUrl: row.logo_file_id ? `/uploads/${row.logo_file_id}` : null,
    faviconUrl: row.favicon_file_id ? `/uploads/${row.favicon_file_id}` : null,
    title: row.title,
    primaryColor: row.primary_color,
    backgroundColor: row.background_color,
  };
}

@Injectable()
export class AppearanceService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** No auth required by the caller (see controller) — the login/register screens need branding before there's a token, and none of this is sensitive. */
  async get(): Promise<AppearanceSettings> {
    const row: AppearanceSettingsRow = await this.knex('appearance_settings').where({ id: 'singleton' }).first();
    return toDomain(row);
  }

  async update(input: UpdateAppearanceSettingsInput, actorUserId: string): Promise<AppearanceSettings> {
    for (const color of [input.primaryColor, input.backgroundColor]) {
      if (color != null && !HEX_COLOR_PATTERN.test(color)) throw new BadRequestException('Couleur invalide (attendu #rrggbb)');
    }

    const update: Record<string, unknown> = { updated_by: actorUserId, updated_at: new Date() };
    if (input.logoFileId !== undefined) {
      await this.assertFileExists(input.logoFileId);
      update.logo_file_id = input.logoFileId;
    }
    if (input.faviconFileId !== undefined) {
      await this.assertFileExists(input.faviconFileId);
      update.favicon_file_id = input.faviconFileId;
    }
    if (input.title !== undefined) update.title = input.title;
    if (input.primaryColor !== undefined) update.primary_color = input.primaryColor;
    if (input.backgroundColor !== undefined) update.background_color = input.backgroundColor;

    await this.knex('appearance_settings').where({ id: 'singleton' }).update(update);
    return this.get();
  }

  private async assertFileExists(fileId: string | null): Promise<void> {
    if (!fileId) return;
    const exists = await this.knex('uploaded_files').where({ id: fileId }).first();
    if (!exists) throw new BadRequestException(`Fichier ${fileId} introuvable`);
  }
}
