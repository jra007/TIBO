import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { TableSchema } from '../../api/types';
import { CURRENT_USER_ID } from '../../auth/currentUser';
import { FieldChip } from './FieldChip';
import { ShelfDropZone } from './ShelfDropZone';
import { emptyShelfAssignment, SHELVES, type Field, type ShelfAssignment, type ShelfId } from './shelves';
import { suggestChartType, type ChartType } from './suggestChartType';

function schemasToFields(schemas: TableSchema[]): Field[] {
  return schemas.flatMap((table) =>
    table.columns.map((column) => ({
      id: `${table.tableName}.${column.columnName}`,
      tableName: table.tableName,
      columnName: column.columnName,
    })),
  );
}

export function ViewBuilderPage() {
  const navigate = useNavigate();
  const [availableFields, setAvailableFields] = useState<Field[]>([]);
  const [shelves, setShelves] = useState<ShelfAssignment>(emptyShelfAssignment);
  const [manualChartType, setManualChartType] = useState<ChartType | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TableSchema[]>('/ingestion/tables')
      .then((schemas) => setAvailableFields(schemasToFields(schemas)))
      .catch(() => setError("Impossible de charger les champs. Importez d'abord des fichiers."));
  }, []);

  const suggestedChartType = useMemo(() => suggestChartType(shelves), [shelves]);
  const activeChartType = manualChartType ?? suggestedChartType;

  const fieldById = useMemo(() => Object.fromEntries(availableFields.map((f) => [f.id, f])), [availableFields]);
  const assignedFieldIds = useMemo(() => new Set(Object.values(shelves).flat().map((f) => f.id)), [shelves]);
  const hasAnyField = Object.values(shelves).some((fields) => fields.length > 0);

  function assignToShelf(field: Field, shelfId: ShelfId) {
    setShelves((prev) => ({ ...prev, [shelfId]: [...prev[shelfId], field] }));
  }

  function removeFromShelf(shelfId: ShelfId, fieldId: string) {
    setShelves((prev) => ({ ...prev, [shelfId]: prev[shelfId].filter((f) => f.id !== fieldId) }));
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
      const stripId = (fields: Field[]) => fields.map(({ tableName, columnName }) => ({ tableName, columnName }));
      await apiClient.post('/views', {
        ownerId: CURRENT_USER_ID,
        name,
        chartType: activeChartType,
        shelves: {
          rows: stripId(shelves.rows),
          columns: stripId(shelves.columns),
          color: stripId(shelves.color),
          size: stripId(shelves.size),
          filters: stripId(shelves.filters),
        },
      });
      navigate('/views');
    } catch {
      setError('Échec de la sauvegarde de la vue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Constructeur de vues</h1>

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

      <div className="save-view">
        <label htmlFor="view-name">Nom de la vue</label>
        <input id="view-name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" onClick={handleSave} disabled={saving || !name || !hasAnyField}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </section>
  );
}
