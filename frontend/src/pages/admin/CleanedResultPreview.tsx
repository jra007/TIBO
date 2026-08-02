import type { CleanedPreview } from '../../api/types';
import { describeCleaningReport } from './cleaning-report';

/**
 * The real cleaned table a correction produces — headers already applied, columns/rows already
 * removed, values trimmed — shown before the actual import runs. Distinct from IngestionPreviewGrid,
 * which only shows the RAW rows with correction controls overlaid on top; this is what would
 * genuinely land in the database.
 */
export function CleanedResultPreview({
  fileName,
  cleaned,
  onConfirm,
  onBack,
  onCancel,
}: {
  fileName: string;
  cleaned: CleanedPreview;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const { headers, rows, totalRows, report } = cleaned;
  const summary = describeCleaningReport(report);

  return (
    <div className="ingestion-preview">
      <h3>Résultat nettoyé de « {fileName} »</h3>
      <p>
        {totalRows} ligne{totalRows > 1 ? 's' : ''} seront importée{totalRows > 1 ? 's' : ''}.
        {summary !== 'Aucun' && ` Nettoyage appliqué : ${summary}.`}
      </p>

      {rows.length === 0 ? (
        <p role="alert" className="error">
          Aucune ligne ne sera importée avec ces réglages — vérifiez l'en-tête et les exclusions.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="preview-grid">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {headers.map((header) => (
                    <td key={header}>{row[header] === null || row[header] === undefined ? '' : String(row[header])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalRows > rows.length && (
        <p>
          Aperçu limité aux {rows.length} premières lignes sur {totalRows} au total.
        </p>
      )}

      <div className="page-actions">
        <button type="button" onClick={onConfirm}>
          Confirmer l'import
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          Modifier les corrections
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler l'import de ce fichier
        </button>
      </div>
    </div>
  );
}
