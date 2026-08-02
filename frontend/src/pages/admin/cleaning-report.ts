import type { CleaningReport } from '../../api/types';

/** Human-readable summary of cleanup (automatic or assisted), for the journal's traceability requirement (nettoyage addendum, section 5). */
export function describeCleaningReport(report: CleaningReport | null): string {
  if (!report) return '—';
  const parts: string[] = [];
  if (report.headerRowIndex > 0) parts.push(`en-tête décalée de ${report.headerRowIndex} ligne(s)`);
  if (report.droppedColumns.length > 0) parts.push(`${report.droppedColumns.length} colonne(s) supprimée(s)`);
  if (report.trailingRowsExcluded > 0) parts.push(`${report.trailingRowsExcluded} ligne(s) exclue(s) (fin de fichier)`);
  if (report.encoding !== 'utf-8') parts.push(`encodage : ${report.encoding}`);
  return parts.length > 0 ? parts.join(', ') : 'Aucun';
}
