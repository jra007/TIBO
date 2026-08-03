import type { CleaningReport } from '../../api/types';

/** Human-readable summary of cleanup (automatic or assisted), for the journal's traceability requirement (nettoyage addendum, section 5). */
export function describeCleaningReport(report: CleaningReport | null): string {
  if (!report) return '—';
  const parts: string[] = [];
  if (report.headerRowIndex > 0) parts.push(`en-tête décalée de ${report.headerRowIndex} ligne(s)`);
  if (report.droppedColumns.length > 0) parts.push(`${report.droppedColumns.length} colonne(s) supprimée(s)`);
  if (report.trailingRowsExcluded > 0) parts.push(`${report.trailingRowsExcluded} ligne(s) exclue(s) (fin de fichier)`);
  if (report.encoding !== 'utf-8') parts.push(`encodage : ${report.encoding}`);
  if (report.duplicateColumnsRenamed?.length > 0) parts.push(`colonne(s) dupliquée(s) renommée(s) : ${report.duplicateColumnsRenamed.join(', ')}`);
  if (report.skippedSheets?.length > 0) parts.push(`onglet(s) ignoré(s) : ${report.skippedSheets.join(', ')}`);
  if (report.mixedCurrencyColumns?.length > 0) parts.push(`⚠ devises mélangées dans : ${report.mixedCurrencyColumns.join(', ')}`);
  return parts.length > 0 ? parts.join(', ') : 'Aucun';
}
