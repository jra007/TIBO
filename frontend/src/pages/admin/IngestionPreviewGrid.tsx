import { useState } from 'react';
import type { CleaningCorrection, FilePreview } from '../../api/types';

/**
 * Assisted-correction grid (nettoyage addendum, section 3): click a row to say "the header is
 * really here", or a row further down to say "exclude this row and everything after it" (a
 * trailing total/comment block) — mouse-only, no formula or line-number entry. Column exclusion is
 * a plain checkbox per header cell. Confirming compiles this into the same CleaningCorrection the
 * backend memorizes and reapplies automatically on the file's next import.
 */
export function IngestionPreviewGrid({
  fileName,
  preview,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  preview: FilePreview;
  onConfirm: (correction: CleaningCorrection) => void;
  onCancel: () => void;
}) {
  const [headerRowIndex, setHeaderRowIndex] = useState(preview.suggestedHeaderRowIndex);
  const [trailingCutoffIndex, setTrailingCutoffIndex] = useState<number | null>(null);
  const [excludedColumns, setExcludedColumns] = useState<Set<number>>(new Set());

  const rows = preview.rows ?? [];
  const totalRows = preview.totalRows ?? rows.length;
  const headerRow = rows.find((r) => r.index === headerRowIndex);

  function toggleColumn(index: number) {
    setExcludedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleConfirm() {
    const trailingRowsToExclude = trailingCutoffIndex === null ? 0 : totalRows - trailingCutoffIndex;
    onConfirm({ headerRowIndex, trailingRowsToExclude, excludedColumnIndexes: [...excludedColumns] });
  }

  return (
    <div className="ingestion-preview">
      <h3>Vérification de « {fileName} »</h3>
      <p>Cliquez sur une ligne pour indiquer l'en-tête réel, ou marquez une ligne de fin (ex. un total) pour l'exclure avec toutes les suivantes.</p>

      {preview.skippedSheets && preview.skippedSheets.length > 0 && (
        <p role="alert" className="error">
          Ce fichier contient {preview.skippedSheets.length + 1} onglets — seul le premier est importé. Onglet(s) ignoré(s) :{' '}
          {preview.skippedSheets.join(', ')}.
        </p>
      )}

      <div className="table-scroll">
        <table className="preview-grid">
          <tbody>
            {rows.map((row) => {
              const isHeader = row.index === headerRowIndex;
              const isExcluded = trailingCutoffIndex !== null && row.index >= trailingCutoffIndex;
              return (
                <tr key={row.index} className={isHeader ? 'preview-header-row' : isExcluded ? 'preview-excluded-row' : undefined}>
                  <td className="preview-row-actions">
                    <button type="button" className="secondary" onClick={() => setHeaderRowIndex(row.index)} disabled={isHeader}>
                      {isHeader ? 'En-tête' : 'Définir comme en-tête'}
                    </button>
                    {row.index > headerRowIndex && (
                      <button type="button" className={isExcluded ? 'danger' : 'secondary'} onClick={() => setTrailingCutoffIndex(isExcluded ? null : row.index)}>
                        {isExcluded ? 'Ré-inclure' : 'Exclure jusqu’à la fin'}
                      </button>
                    )}
                  </td>
                  {row.cells.map((cell, colIndex) => (
                    <td key={colIndex}>{cell === null || cell === undefined ? '' : String(cell)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {headerRow && (
        <fieldset>
          <legend>Colonnes à exclure</legend>
          {headerRow.cells.map((cell, colIndex) => (
            <label key={colIndex} className="preview-column-toggle">
              <input type="checkbox" checked={excludedColumns.has(colIndex)} onChange={() => toggleColumn(colIndex)} />
              {cell === null || cell === undefined || cell === '' ? `Colonne ${colIndex + 1}` : String(cell)}
            </label>
          ))}
        </fieldset>
      )}

      <div className="page-actions">
        <button type="button" onClick={handleConfirm}>
          Confirmer
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler l'import de ce fichier
        </button>
      </div>
    </div>
  );
}
