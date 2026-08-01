import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { JournalEntry, UploadResponse } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function IngestionJournalPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    const formData = new FormData();
    for (const file of files) formData.append('files', file);

    setUploading(true);
    setError(null);
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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === journal.length ? [] : journal.map((entry) => entry.id)));
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

      {result && (
        <p>
          {result.relations.length} relation(s) proposée(s) ou mise(s) à jour — voir l'onglet{' '}
          <Link to="/admin/relations">Relations</Link>.
        </p>
      )}

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
              <input
                id="select-all-journal"
                type="checkbox"
                checked={journal.length > 0 && selectedIds.length === journal.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th scope="col">Date</th>
            <th scope="col">Fichier</th>
            <th scope="col">Table</th>
            <th scope="col">Lignes</th>
            <th scope="col">Statut</th>
            <th scope="col">Erreurs</th>
          </tr>
        </thead>
        <tbody>
          {journal.map((entry) => (
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
              <td>{entry.status === 'success' ? 'Succès' : 'Erreur'}</td>
              <td>{entry.errors.join(', ')}</td>
            </tr>
          ))}
          {journal.length === 0 && (
            <tr>
              <td colSpan={7}>Aucun import pour le moment.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
