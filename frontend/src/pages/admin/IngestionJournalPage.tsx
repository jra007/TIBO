import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { CleaningCorrection, CleaningReport, FilePreview, JournalEntry, UploadResponse } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IngestionPreviewGrid } from './IngestionPreviewGrid';

interface ReviewState {
  file: File;
  preview: FilePreview;
  remainingQueue: File[];
  allFiles: File[];
  corrections: Record<string, CleaningCorrection>;
}

const STATUS_LABELS: Record<JournalEntry['status'], string> = {
  success: 'Succès',
  error: 'Erreur',
  duplicate: 'Doublon rejeté',
  pending_review: 'En attente de validation',
};

/** Human-readable summary of cleanup (automatic or assisted), for the journal's traceability requirement (nettoyage addendum, section 5). */
function describeCleaningReport(report: CleaningReport | null): string {
  if (!report) return '—';
  const parts: string[] = [];
  if (report.headerRowIndex > 0) parts.push(`en-tête décalée de ${report.headerRowIndex} ligne(s)`);
  if (report.droppedColumns.length > 0) parts.push(`${report.droppedColumns.length} colonne(s) supprimée(s)`);
  if (report.trailingRowsExcluded > 0) parts.push(`${report.trailingRowsExcluded} ligne(s) exclue(s) (fin de fichier)`);
  if (report.encoding !== 'utf-8') parts.push(`encodage : ${report.encoding}`);
  return parts.length > 0 ? parts.join(', ') : 'Aucun';
}

const DATE_PRESETS = [
  { value: 'all', label: 'Toutes les dates' },
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: 'custom', label: 'Période personnalisée' },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]['value'];

function presetStartDate(preset: DatePreset): Date | null {
  const now = new Date();
  if (preset === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === '7d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return from;
  }
  if (preset === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return from;
  }
  return null;
}

export function IngestionJournalPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [currentReview, setCurrentReview] = useState<ReviewState | null>(null);

  useEffect(() => {
    loadJournal();
  }, []);

  async function loadJournal() {
    const entries = await apiClient.get<JournalEntry[]>('/ingestion/journal');
    setJournal(entries);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setResult(null);
    const fileArray = Array.from(files);
    await advanceQueue(fileArray, fileArray, {});
  }

  /**
   * Checks each selected file, one at a time: a file with a memorized cleaning rule (see
   * IngestionPreviewGrid) goes straight through, an unseen or ambiguous file pauses here and
   * shows the review grid — the real import only happens once every file has been resolved one
   * way or the other (addendum section 3: preview only when needed, never on every import).
   */
  async function advanceQueue(queue: File[], allFiles: File[], corrections: Record<string, CleaningCorrection>) {
    if (queue.length === 0) {
      await finalizeUpload(allFiles, corrections);
      return;
    }
    const [next, ...rest] = queue;
    try {
      const previewForm = new FormData();
      previewForm.append('file', next);
      const preview = await apiClient.postForm<FilePreview>('/ingestion/preview', previewForm);
      if (preview.hasMemorizedRule) {
        await advanceQueue(rest, allFiles, corrections);
      } else {
        setCurrentReview({ file: next, preview, remainingQueue: rest, allFiles, corrections });
        setUploading(false);
      }
    } catch {
      setError(`Échec de l'aperçu pour ${next.name}.`);
      setUploading(false);
    }
  }

  async function handleConfirmReview(correction: CleaningCorrection) {
    if (!currentReview) return;
    const updatedCorrections = { ...currentReview.corrections, [currentReview.file.name]: correction };
    setCurrentReview(null);
    setUploading(true);
    await advanceQueue(currentReview.remainingQueue, currentReview.allFiles, updatedCorrections);
  }

  async function handleCancelReview() {
    if (!currentReview) return;
    const updatedAllFiles = currentReview.allFiles.filter((f) => f !== currentReview.file);
    setCurrentReview(null);
    setUploading(true);
    await advanceQueue(currentReview.remainingQueue, updatedAllFiles, currentReview.corrections);
  }

  async function finalizeUpload(allFiles: File[], corrections: Record<string, CleaningCorrection>) {
    if (allFiles.length === 0) {
      setUploading(false);
      return;
    }
    const formData = new FormData();
    for (const file of allFiles) formData.append('files', file);
    formData.append('corrections', JSON.stringify(corrections));
    try {
      const response = await apiClient.postForm<UploadResponse>('/ingestion/upload', formData);
      setResult(response);
      await loadJournal();
    } catch {
      setError("Échec de l'import. Vérifiez que le backend est démarré.");
    } finally {
      setUploading(false);
    }
  }

  const filteredJournal = useMemo(() => {
    if (datePreset === 'all') return journal;
    if (datePreset === 'custom') {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo) : null;
      if (to) to.setHours(23, 59, 59, 999);
      return journal.filter((entry) => {
        const importedAt = new Date(entry.importedAt);
        if (from && importedAt < from) return false;
        if (to && importedAt > to) return false;
        return true;
      });
    }
    const from = presetStartDate(datePreset);
    return journal.filter((entry) => !from || new Date(entry.importedAt) >= from);
  }, [journal, datePreset, customFrom, customTo]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    const filteredIds = filteredJournal.map((entry) => entry.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => (allSelected ? prev.filter((id) => !filteredIds.includes(id)) : [...new Set([...prev, ...filteredIds])]));
  }

  async function confirmDeleteSelected() {
    setShowConfirmDelete(false);
    setDeleting(true);
    setError(null);
    try {
      await apiClient.delete('/ingestion/journal', { ids: selectedIds });
      setSelectedIds([]);
      await loadJournal();
    } catch {
      setError("Échec de la suppression de l'historique sélectionné.");
    } finally {
      setDeleting(false);
    }
  }

  const allFilteredSelected = filteredJournal.length > 0 && filteredJournal.every((entry) => selectedIds.includes(entry.id));

  return (
    <section>
      <h2>Journal d'ingestion</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="ingestion-files">Fichiers xlsx / csv</label>
        <input id="ingestion-files" type="file" multiple accept=".xlsx,.csv" onChange={(e) => setFiles(e.target.files)} />
        <button type="submit" disabled={uploading || !files?.length}>
          {uploading ? 'Import en cours…' : 'Importer'}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {currentReview && (
        <IngestionPreviewGrid fileName={currentReview.file.name} preview={currentReview.preview} onConfirm={handleConfirmReview} onCancel={handleCancelReview} />
      )}

      {result && (
        <div className="upload-result">
          <ul>
            {result.imports.map((entry, index) => (
              <li key={index} className={entry.status === 'success' ? undefined : entry.status === 'error' ? 'error' : 'warning'}>
                <strong>{entry.fileName}</strong> —{' '}
                {entry.status === 'success' ? `${entry.rowCount} ligne(s) importée(s)` : entry.errors.join(', ')}
                {entry.status === 'success' && entry.cleaningReport && describeCleaningReport(entry.cleaningReport) !== 'Aucun' && (
                  <span className="cleaning-summary"> · Nettoyage : {describeCleaningReport(entry.cleaningReport)}</span>
                )}
              </li>
            ))}
          </ul>
          {result.relations.length > 0 && (
            <p>
              {result.relations.length} relation(s) proposée(s) ou mise(s) à jour — voir l'onglet{' '}
              <Link to="/admin/relations">Relations</Link>.
            </p>
          )}
        </div>
      )}

      <fieldset className="filter-bar">
        <legend>Filtrer par date</legend>
        <label htmlFor="journal-date-preset" className="visually-hidden">
          Période
        </label>
        <select id="journal-date-preset" value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)}>
          {DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        {datePreset === 'custom' && (
          <>
            <label htmlFor="journal-date-from">Du</label>
            <input id="journal-date-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <label htmlFor="journal-date-to">Au</label>
            <input id="journal-date-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </fieldset>

      <div className="page-actions">
        <button type="button" className="danger" disabled={selectedIds.length === 0 || deleting} onClick={() => setShowConfirmDelete(true)}>
          Supprimer la sélection ({selectedIds.length})
        </button>
      </div>

      <ConfirmDialog
        open={showConfirmDelete}
        title="Supprimer l'historique sélectionné"
        message={`Supprimer ${selectedIds.length} entrée(s) du journal d'ingestion ? Cela ne supprime aucune donnée déjà importée (chaque import remplace intégralement la table précédente) — uniquement l'historique.`}
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={confirmDeleteSelected}
        onCancel={() => setShowConfirmDelete(false)}
      />

      <table>
        <caption>Historique des imports</caption>
        <thead>
          <tr>
            <th scope="col">
              <label className="visually-hidden" htmlFor="select-all-journal">
                Tout sélectionner
              </label>
              <input id="select-all-journal" type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} />
            </th>
            <th scope="col">Date</th>
            <th scope="col">Fichier</th>
            <th scope="col">Table</th>
            <th scope="col">Lignes</th>
            <th scope="col">Statut</th>
            <th scope="col">Erreurs</th>
            <th scope="col">Nettoyage</th>
          </tr>
        </thead>
        <tbody>
          {filteredJournal.map((entry) => (
            <tr key={entry.id}>
              <td>
                <label className="visually-hidden" htmlFor={`select-${entry.id}`}>
                  Sélectionner l'import {entry.fileName} du {new Date(entry.importedAt).toLocaleString('fr-FR')}
                </label>
                <input id={`select-${entry.id}`} type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleSelected(entry.id)} />
              </td>
              <td>{new Date(entry.importedAt).toLocaleString('fr-FR')}</td>
              <td>{entry.fileName}</td>
              <td>{entry.tableName}</td>
              <td>{entry.rowCount}</td>
              <td>{STATUS_LABELS[entry.status]}</td>
              <td>{entry.errors.join(', ')}</td>
              <td>{describeCleaningReport(entry.cleaningReport)}</td>
            </tr>
          ))}
          {filteredJournal.length === 0 && (
            <tr>
              <td colSpan={8}>{journal.length === 0 ? 'Aucun import pour le moment.' : 'Aucun import ne correspond à cette période.'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
