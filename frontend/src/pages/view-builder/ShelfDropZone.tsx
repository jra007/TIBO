import { useDroppable } from '@dnd-kit/core';
import { displayLabel, type Aggregation, type Field, type ShelfId } from './shelves';

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Somme',
  avg: 'Moyenne',
  count: 'Comptage',
  min: 'Min',
  max: 'Max',
};

export function ShelfDropZone({
  id,
  label,
  fields,
  onRemove,
  onAggregationChange,
}: {
  id: ShelfId;
  label: string;
  fields: Field[];
  onRemove: (fieldId: string) => void;
  onAggregationChange: (fieldId: string, aggregation: Aggregation | undefined) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <fieldset ref={setNodeRef} className="shelf-drop-zone" data-over={isOver}>
      <legend>{label}</legend>
      <ul>
        {fields.map((field) => (
          <li key={field.id}>
            {displayLabel(field)}
            {field.dtype === 'numeric' && (
              <label>
                Agrégation
                <select
                  aria-label={`Agrégation pour ${displayLabel(field)}`}
                  value={field.aggregation ?? ''}
                  onChange={(e) => onAggregationChange(field.id, e.target.value ? (e.target.value as Aggregation) : undefined)}
                >
                  <option value="">Aucune (dimension)</option>
                  {(Object.keys(AGGREGATION_LABELS) as Aggregation[]).map((agg) => (
                    <option key={agg} value={agg}>
                      {AGGREGATION_LABELS[agg]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" aria-label={`Retirer ${displayLabel(field)} de ${label}`} onClick={() => onRemove(field.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
