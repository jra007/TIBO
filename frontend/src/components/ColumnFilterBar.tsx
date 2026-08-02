import { useState } from 'react';
import { OPERATOR_LABELS, defaultFilterValue, operatorsForDtype, valueInputType, type FilterValue } from '../pages/view-builder/shelves';
import type { ActiveColumnFilter, FilterableField } from './column-filters';

function fieldKey(f: { tableName: string; columnName: string }): string {
  return `${f.tableName}.${f.columnName}`;
}

/**
 * Viewer-facing column filters, remembered per-browser (see loadStoredFilters/storeFilters) —
 * distinct from the view builder's "Filtres" shelf, which the view's creator sets once and which
 * is baked into the saved view for every viewer. This bar lets anyone consuming the view narrow
 * it further, on their own, without editing the view itself or affecting other viewers.
 */
export function ColumnFilterBar({
  availableFields,
  activeFilters,
  onChange,
}: {
  availableFields: FilterableField[];
  activeFilters: ActiveColumnFilter[];
  onChange: (filters: ActiveColumnFilter[]) => void;
}) {
  const [pendingFieldKey, setPendingFieldKey] = useState('');
  const activeKeys = new Set(activeFilters.map(fieldKey));
  const selectableFields = availableFields.filter((f) => !activeKeys.has(fieldKey(f)));

  function addFilter() {
    const field = availableFields.find((f) => fieldKey(f) === pendingFieldKey);
    if (!field) return;
    onChange([...activeFilters, { ...field, filter: defaultFilterValue(field.dtype) }]);
    setPendingFieldKey('');
  }

  function updateFilter(key: string, filter: FilterValue) {
    onChange(activeFilters.map((f) => (fieldKey(f) === key ? { ...f, filter } : f)));
  }

  function removeFilter(key: string) {
    onChange(activeFilters.filter((f) => fieldKey(f) !== key));
  }

  if (availableFields.length === 0) return null;

  return (
    <div className="column-filter-bar">
      {activeFilters.map((active) => {
        const key = fieldKey(active);
        const inputType = valueInputType(active.dtype);
        return (
          <div className="column-filter-chip" key={key}>
            <span className="column-filter-label">{active.label}</span>
            <label className="visually-hidden" htmlFor={`filter-op-${key}`}>
              Condition pour {active.label}
            </label>
            <select
              id={`filter-op-${key}`}
              value={active.filter.operator}
              onChange={(e) => updateFilter(key, { ...active.filter, operator: e.target.value as FilterValue['operator'] })}
            >
              {operatorsForDtype(active.dtype).map((operator) => (
                <option key={operator} value={operator}>
                  {OPERATOR_LABELS[operator]}
                </option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor={`filter-value-${key}`}>
              Valeur pour {active.label}
            </label>
            <input
              id={`filter-value-${key}`}
              type={inputType}
              value={active.filter.value}
              onChange={(e) => updateFilter(key, { ...active.filter, value: e.target.value })}
            />
            {active.filter.operator === 'between' && (
              <>
                <span>et</span>
                <label className="visually-hidden" htmlFor={`filter-value2-${key}`}>
                  Deuxième valeur pour {active.label}
                </label>
                <input
                  id={`filter-value2-${key}`}
                  type={inputType}
                  value={active.filter.value2 ?? ''}
                  onChange={(e) => updateFilter(key, { ...active.filter, value2: e.target.value })}
                />
              </>
            )}
            <button type="button" className="secondary" aria-label={`Retirer le filtre sur ${active.label}`} onClick={() => removeFilter(key)}>
              ×
            </button>
          </div>
        );
      })}

      {selectableFields.length > 0 && (
        <div className="column-filter-add">
          <label className="visually-hidden" htmlFor="column-filter-add-field">
            Ajouter un filtre sur une colonne
          </label>
          <select id="column-filter-add-field" value={pendingFieldKey} onChange={(e) => setPendingFieldKey(e.target.value)}>
            <option value="">+ Filtrer une colonne…</option>
            {selectableFields.map((f) => (
              <option key={fieldKey(f)} value={fieldKey(f)}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={addFilter} disabled={!pendingFieldKey}>
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
