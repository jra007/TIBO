import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { SavedView, TableSchema } from '../../api/types';
import { FieldChip } from './FieldChip';
import { ShelfDropZone } from './ShelfDropZone';
import { emptyShelfAssignment, SHELVES, type Aggregation, type Field, type ShelfAssignment, type ShelfId } from './shelves';
import { suggestChartType, type ChartType } from './suggestChartType';

function schemasToFields(schemas: TableSchema[]): Field[] {
  return schemas.flatMap((table) =>
    table.columns.map((column) => ({
      id: `${table.tableName}.${column.columnName}`,
      tableName: table.tableName,
      columnName: column.columnName,
      dtype: column.dtype,
    })),
  );
}

function fieldRefToField(ref: { tableName: string; columnName: string; aggregation?: Aggregation }, availableFields: Field[]): Field {
  const match = availableFields.find((f) => f.tableName === ref.tableName && f.columnName === ref.columnName);
  return {
    id: `${ref.tableName}.${ref.columnName}`,
    tableName: ref.tableName,
    columnName: ref.columnName,
    dtype: match?.dtype ?? 'text',
    aggregation: ref.aggregation,
  };
}

export function ViewBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [availableFields, setAvailableFields] = useState<Field[]>([]);
  const [shelves, setShelves] = useState<ShelfAssignment>(emptyShelfAssignment);
  const [manualChartType, setManualChartType] = useState<ChartType | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TableSchema[]>('/ingestion/tables')
      .then((schemas) => setAvailableFields(schemasToFields(schemas)))
      .catch(() => setError("Impossible de charger les champs. Importez d'abord des fichiers."));
  }, []);

  useEffect(() => {
    if (!id || availableFields.length === 0) return;
    apiClient
      .get<SavedView>(`/views/${id}`)
      .then((view) => {
        setName(view.name);
        setManualChartType(view.chartType);
        setShelves({
          rows: view.shelves.rows.map((f) => fieldRefToField(f, availableFields)),
          columns: view.shelves.columns.map((f) => fieldRefToField(f, availableFields)),
          color: view.shelves.color.map((f) => fieldRefToField(f, availableFields)),
          size: view.shelves.size.map((f) => fieldRefToField(f, availableFields)),
          filters: view.shelves.filters.map((f) => fieldRefToField(f, availableFields)),
        });
      })
      .catch(() => setError('Impossible de charger cette vue.'))
      .finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, availableFields.length]);

  const suggestedChartType = useMemo(() => suggestChartType(shelves), [shelves]);
  const activeChartType = manualChartType ?? suggestedChartType;

  const fieldById = useMemo(() => Object.fromEntries(availableFields.map((f) => [f.id, f])), [availableFields]);
  const assignedFieldIds = useMemo(() => new Set(Object.values(shelves).flat().map((f) => f.id)), [shelves]);
  const hasAnyField = Object.values(shelves).some((fields) => fields.length > 0);

  function assignToShelf(field: Field, shelfId: ShelfId) {
    // Numeric fields default to summed measures (spec 3.1.3's standard aggregations); switchable
    // per-field once placed, including back to "no aggregation" for numeric fields used as dimensions.
    const placedField = field.dtype === 'numeric' ? { ...field, aggregation: field.aggregation ?? ('sum' as Aggregation) } : field;
    setShelves((prev) => ({ ...prev, [shelfId]: [...prev[shelfId], placedField] }));
  }

  function removeFromShelf(shelfId: ShelfId, fieldId: string) {
    setShelves((prev) => ({ ...prev, [shelfId]: prev[shelfId].filter((f) => f.id !== fieldId) }));
  }

  function updateAggregation(shelfId: ShelfId, fieldId: string, aggregation: Aggregation | undefined) {
    setShelves((prev) => ({
      ...prev,
      [shelfId]: prev[shelfId].map((f) => (f.id === fieldId ? { ...f, aggregation } : f)),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const field = event.active.data.current?.field as Field | undefined;
    const shelfId = event.over?.id as ShelfId | undefined;
    if (field && shelfId) assignToShelf(field, shelfId);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const stripId = (fields: Field[]) => fields.map(({ tableName, columnName, aggregation }) => ({ tableName, columnName, aggregation }));
      const payload = {
        name,
        chartType: activeChartType,
        shelves: {
          rows: stripId(shelves.rows),
          columns: stripId(shelves.columns),
          color: stripId(shelves.color),
          size: stripId(shelves.size),
          filters: stripId(shelves.filters),
        },
      };
      if (isEditing) {
        await apiClient.put(`/views/${id}`, payload);
        navigate(`/views/${id}`);
      } else {
        await apiClient.post('/views', payload);
        navigate('/views');
      }
    } catch {
      setError('Échec de la sauvegarde de la vue.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingExisting) return <p>Chargement…</p>;

  return (
    <section>
      <div className="page-header">
        <h1>{isEditing ? 'Modifier la vue' : 'Constructeur de vues'}</h1>
        <div className="save-view">
          <label htmlFor="view-name" className="visually-hidden">
            Nom de la vue
          </label>
          <input id="view-name" placeholder="Nom de la vue" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" onClick={handleSave} disabled={saving || !name || !hasAnyField}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="view-builder-layout">
          <aside aria-label="Champs disponibles">
            <h2>Champs</h2>
            {availableFields.filter((f) => !assignedFieldIds.has(f.id)).map((field) => (
              <FieldChip key={field.id} field={fieldById[field.id]} onAddToShelf={(shelfId) => assignToShelf(field, shelfId)} />
            ))}
          </aside>
          <div className="shelves">
            {SHELVES.map((shelf) => (
              <ShelfDropZone
                key={shelf.id}
                id={shelf.id}
                label={shelf.label}
                fields={shelves[shelf.id]}
                onRemove={(fieldId) => removeFromShelf(shelf.id, fieldId)}
                onAggregationChange={(fieldId, aggregation) => updateAggregation(shelf.id, fieldId, aggregation)}
              />
            ))}
          </div>
          <div className="chart-preview">
            <label>
              Type de graphique
              <select value={activeChartType} onChange={(e) => setManualChartType(e.target.value as ChartType)}>
                <option value="bar">Barres</option>
                <option value="line">Ligne</option>
                <option value="scatter">Nuage de points</option>
                <option value="heatmap">Carte de chaleur</option>
                <option value="table">Table</option>
                <option value="geo">Carte géographique</option>
              </select>
            </label>
            {manualChartType === null && <p>Suggestion automatique : {suggestedChartType}</p>}
          </div>
        </div>
      </DndContext>
    </section>
  );
}
