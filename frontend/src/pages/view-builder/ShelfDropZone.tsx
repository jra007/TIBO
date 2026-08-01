import { useDroppable } from '@dnd-kit/core';
import { displayLabel, OPERATOR_LABELS, operatorsForDtype, type Aggregation, type Field, type FilterValue, type ShelfId } from './shelves';

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Somme',
  avg: 'Moyenne',
  count: 'Comptage',
  min: 'Min',
  max: 'Max',
};

function valueInputType(dtype: Field['dtype']): 'date' | 'number' | 'text' {
  if (dtype === 'date') return 'date';
  if (dtype === 'numeric') return 'number';
  return 'text';
}

function FilterControls({ field, onFilterChange }: { field: Field; onFilterChange: (fieldId: string, filter: FilterValue) => void }) {
  const filter = field.filter ?? { operator: operatorsForDtype(field.dtype)[0], value: '' };
  const inputType = valueInputType(field.dtype);

  return (
    <>
      <label className="filter-field">
        Condition
        <select
          aria-label={`Condition pour ${displayLabel(field)}`}
          value={filter.operator}
          onChange={(e) => onFilterChange(field.id, { ...filter, operator: e.target.value as FilterValue['operator'] })}
        >
          {operatorsForDtype(field.dtype).map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        Valeur
        <input
          aria-label={`Valeur pour ${displayLabel(field)}`}
          type={inputType}
          value={filter.value}
          onChange={(e) => onFilterChange(field.id, { ...filter, value: e.target.value })}
        />
      </label>
      {filter.operator === 'between' && (
        <label className="filter-field">
          et
          <input
            aria-label={`Deuxième valeur pour ${displayLabel(field)}`}
            type={inputType}
            value={filter.value2 ?? ''}
            onChange={(e) => onFilterChange(field.id, { ...filter, value2: e.target.value })}
          />
        </label>
      )}
    </>
  );
}

export function ShelfDropZone({
  id,
  label,
  fields,
  onRemove,
  onAggregationChange,
  onFilterChange,
}: {
  id: ShelfId;
  label: string;
  fields: Field[];
  onRemove: (fieldId: string) => void;
  onAggregationChange: (fieldId: string, aggregation: Aggregation | undefined) => void;
  onFilterChange: (fieldId: string, filter: FilterValue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <fieldset ref={setNodeRef} className="shelf-drop-zone" data-over={isOver}>
      <legend>{label}</legend>
      <ul>
        {fields.map((field) => (
          <li key={field.id}>
            {displayLabel(field)}
            {id === 'filters' ? (
              <FilterControls field={field} onFilterChange={onFilterChange} />
            ) : (
              field.dtype === 'numeric' && (
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
              )
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
