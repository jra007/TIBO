import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.constants';

export interface ReportSettings {
  headerTitle: string | null;
  headerSubtitle: string | null;
  showLogo: boolean;
  showPageNumbers: boolean;
  showExportDate: boolean;
}

/** Any field omitted = unchanged; explicit null (for the two text fields) = reset to default. */
export interface UpdateReportSettingsInput {
  headerTitle?: string | null;
  headerSubtitle?: string | null;
  showLogo?: boolean;
  showPageNumbers?: boolean;
  showExportDate?: boolean;
}

interface ReportSettingsRow {
  header_title: string | null;
  header_subtitle: string | null;
  show_logo: boolean;
  show_page_numbers: boolean;
  show_export_date: boolean;
}

function toDomain(row: ReportSettingsRow): ReportSettings {
  return {
    headerTitle: row.header_title,
    headerSubtitle: row.header_subtitle,
    showLogo: row.show_logo,
    showPageNumbers: row.show_page_numbers,
    showExportDate: row.show_export_date,
  };
}

@Injectable()
export class ReportSettingsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async get(): Promise<ReportSettings> {
    const row: ReportSettingsRow = await this.knex('report_settings').where({ id: 'singleton' }).first();
    return toDomain(row);
  }

  async update(input: UpdateReportSettingsInput, actorUserId: string): Promise<ReportSettings> {
    const update: Record<string, unknown> = { updated_by: actorUserId, updated_at: new Date() };
    if (input.headerTitle !== undefined) update.header_title = input.headerTitle;
    if (input.headerSubtitle !== undefined) update.header_subtitle = input.headerSubtitle;
    if (input.showLogo !== undefined) update.show_logo = input.showLogo;
    if (input.showPageNumbers !== undefined) update.show_page_numbers = input.showPageNumbers;
    if (input.showExportDate !== undefined) update.show_export_date = input.showExportDate;

    await this.knex('report_settings').where({ id: 'singleton' }).update(update);
    return this.get();
  }
}
