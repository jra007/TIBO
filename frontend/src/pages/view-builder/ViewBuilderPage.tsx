import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { FieldChip } from './FieldChip';
import { ShelfDropZone } from './ShelfDropZone';
import { emptyShelfAssignment, SHELVES, type Field, type ShelfAssignment, type ShelfId } from './shelves';
import { suggestChartType, type ChartType } from './suggestChartType';

// Placeholder until the semantic layer (dimensions/mesures/relations validées) is wired in.
const AVAILABLE_FIELDS: Field[] = [
  { id: 'orders.order_date', tableName: 'orders', columnName: 'order_date' },
  { id: 'orders.amount', tableName: 'orders', columnName: 'amount' },
  { id: 'customers.region', tableName: 'customers', columnName: 'region' },
];

export function ViewBuilderPage() {
  const [shelves, setShelves] = useState<ShelfAssignment>(emptyShelfAssignment);
  const [manualChartType, setManualChartType] = useState<ChartType | null>(null);

  const suggestedChartType = useMemo(() => suggestChartType(shelves), [shelves]);
  const activeChartType = manualChartType ?? suggestedChartType;

  const fieldById = useMemo(() => Object.fromEntries(AVAILABLE_FIELDS.map((f) => [f.id, f])), []);
  const assignedFieldIds = useMemo(() => new Set(Object.values(shelves).flat().map((f) => f.id)), [shelves]);

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

  return (
    <section>
      <h1>Constructeur de vues</h1>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="view-builder-layout">
          <aside aria-label="Champs disponibles">
            <h2>Champs</h2>
            {AVAILABLE_FIELDS.filter((f) => !assignedFieldIds.has(f.id)).map((field) => (
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
    </section>
  );
}
