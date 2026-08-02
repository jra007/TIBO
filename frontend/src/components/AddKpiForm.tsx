import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { Aggregation, SavedView, TableSchema } from '../api/types';

const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: 'sum', label: 'Somme' },
  { value: 'avg', label: 'Moyenne' },
  { value: 'count', label: 'Comptage' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

interface NumericField {
  tableName: string;
  columnName: string;
  label: string;
}

function fieldKey(f: { tableName: string; columnName: string }): string {
  return `${f.tableName}.${f.columnName}`;
}

/**
 * Creates a KPI — a saved view with chartType 'number', one aggregated measure, no dimensions
 * (see suggestChartType.ts and view-query-builder.ts's no-GROUP-BY path) — in one step, instead
 * of requiring a trip through the full view builder just to place one field. The caller is
 * responsible for adding the created view to whatever dashboard is asking for it.
 */
export function AddKpiForm({ onCreated, onCancel }: { onCreated: (view: SavedView) => Promise<void>; onCancel: () => void }) {
  const [fields, setFields] = useState<NumericField[]>([]);
  const [fieldKeyValue, setFieldKeyValue] = useState('');
  const [aggregation, setAggregation] = useState<Aggregation>('sum');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<TableSchema[]>('/ingestion/tables').then((schemas) => {
      setFields(
        schemas.flatMap((table) =>
          table.columns
            .filter((column) => column.dtype === 'numeric')
            .map((column) => ({ tableName: table.tableName, columnName: column.columnName, label: column.label ?? column.columnName })),
        ),
      );
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const field = fields.find((f) => fieldKey(f) === fieldKeyValue);
    if (!field) return;
    setSaving(true);
    setError(null);
    try {
      const view = await apiClient.post<SavedView>('/views', {
        name: label,
        chartType: 'number',
        shelves: {
          rows: [],
          columns: [{ tableName: field.tableName, columnName: field.columnName, aggregation }],
          color: [],
          size: [],
          filters: [],
        },
        calculatedFields: [],
        quickStatFields: [],
      });
      await onCreated(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création de l'indicateur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="calculated-field-form">
      <h3>Ajouter un indicateur</h3>
      <label htmlFor="kpi-label">Nom de l'indicateur</label>
      <input id="kpi-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Chiffre d'affaires total" required />
      <label htmlFor="kpi-field">Colonne</label>
      <select id="kpi-field" value={fieldKeyValue} onChange={(e) => setFieldKeyValue(e.target.value)} required>
        <option value="">Choisir une colonne numérique…</option>
        {fields.map((f) => (
          <option key={fieldKey(f)} value={fieldKey(f)}>
            {f.label} ({f.tableName})
          </option>
        ))}
      </select>
      <label htmlFor="kpi-aggregation">Calcul</label>
      <select id="kpi-aggregation" value={aggregation} onChange={(e) => setAggregation(e.target.value as Aggregation)}>
        {AGGREGATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="page-actions">
        <button type="submit" disabled={saving || !label || !fieldKeyValue}>
          {saving ? 'Création…' : 'Ajouter'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
