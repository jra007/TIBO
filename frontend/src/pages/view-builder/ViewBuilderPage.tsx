import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CALCULATED_FIELD_TABLE, type CalculatedField, type FilterCondition, type SavedView, type TableSchema } from '../../api/types';
import { CalculatedFieldEditor } from './CalculatedFieldEditor';
import { FieldChip } from './FieldChip';
import { ShelfDropZone } from './ShelfDropZone';
import {
  defaultFilterValue,
  displayLabel,
  emptyShelfAssignment,
  SHELVES,
  type Aggregation,
  type Field,
  type FilterValue,
  type ShelfAssignment,
  type ShelfId,
} from './shelves';
import { CONDITION_FIELD_DROP_ID, emptySimpleCondition, type SimpleCondition } from './simple-condition';
import { suggestChartType, type ChartType } from './suggestChartType';

function schemasToFields(schemas: TableSchema[]): Field[] {
  return schemas.flatMap((table) =>
    table.columns.map((column) => ({
      id: `${table.tableName}.${column.columnName}`,
      tableName: table.tableName,
      columnName: column.columnName,
      dtype: column.dtype,
      label: column.label,
    })),
  );
}

function calculatedFieldToField(calculatedField: CalculatedField): Field {
  return {
    id: `${CALCULATED_FIELD_TABLE}.${calculatedField.id}`,
    tableName: CALCULATED_FIELD_TABLE,
    columnName: calculatedField.id,
    dtype: calculatedField.dtype,
    label: calculatedField.label,
  };
}

function fieldRefToField(ref: { tableName: string; columnName: string; aggregation?: Aggregation }, availableFields: Field[]): Field {
  const match = availableFields.find((f) => f.tableName === ref.tableName && f.columnName === ref.columnName);
  return {
    id: `${ref.tableName}.${ref.columnName}`,
    tableName: ref.tableName,
    columnName: ref.columnName,
    dtype: match?.dtype ?? 'text',
    label: match?.label ?? null,
    aggregation: ref.aggregation,
  };
}

function filterConditionToField(condition: FilterCondition, availableFields: Field[]): Field {
  const match = availableFields.find((f) => f.tableName === condition.tableName && f.columnName === condition.columnName);
  return {
    id: `${condition.tableName}.${condition.columnName}`,
    tableName: condition.tableName,
    columnName: condition.columnName,
    dtype: match?.dtype ?? 'text',
    label: match?.label ?? null,
    filter: { operator: condition.operator, value: condition.value ?? '', value2: condition.value2 ?? undefined },
  };
}

export function ViewBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [schemaFields, setSchemaFields] = useState<Field[]>([]);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);
  const [editingCalculatedField, setEditingCalculatedField] = useState<'new' | CalculatedField | null>(null);
  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(emptySimpleCondition());
  const [fieldSearch, setFieldSearch] = useState('');
  const [shelves, setShelves] = useState<ShelfAssignment>(emptyShelfAssignment);
  const [manualChartType, setManualChartType] = useState<ChartType | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TableSchema[]>('/ingestion/tables')
      .then((schemas) => setSchemaFields(schemasToFields(schemas)))
      .catch(() => setError("Impossible de charger les champs. Importez d'abord des fichiers."));
  }, []);

  useEffect(() => {
    if (!id || schemaFields.length === 0) return;
    apiClient
      .get<SavedView>(`/views/${id}`)
      .then((view) => {
        setName(view.name);
        setManualChartType(view.chartType);
        setCalculatedFields(view.calculatedFields);
        const combinedFields = [...schemaFields, ...view.calculatedFields.map(calculatedFieldToField)];
        setShelves({
          rows: view.shelves.rows.map((f) => fieldRefToField(f, combinedFields)),
          columns: view.shelves.columns.map((f) => fieldRefToField(f, combinedFields)),
          color: view.shelves.color.map((f) => fieldRefToField(f, combinedFields)),
          size: view.shelves.size.map((f) => fieldRefToField(f, combinedFields)),
          filters: view.shelves.filters.map((f) => filterConditionToField(f, combinedFields)),
        });
      })
      .catch(() => setError('Impossible de charger cette vue.'))
      .finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, schemaFields.length]);

  const suggestedChartType = useMemo(() => suggestChartType(shelves), [shelves]);
  const activeChartType = manualChartType ?? suggestedChartType;

  const availableFields = useMemo(
    () => [...schemaFields, ...calculatedFields.map(calculatedFieldToField)],
    [schemaFields, calculatedFields],
  );
  const fieldById = useMemo(() => Object.fromEntries(availableFields.map((f) => [f.id, f])), [availableFields]);
  const assignedFieldIds = useMemo(() => new Set(Object.values(shelves).flat().map((f) => f.id)), [shelves]);
  const hasAnyField = Object.values(shelves).some((fields) => fields.length > 0);

  const unassignedFields = useMemo(() => availableFields.filter((f) => !assignedFieldIds.has(f.id)), [availableFields, assignedFieldIds]);
  const visibleFields = useMemo(() => {
    const query = fieldSearch.trim().toLowerCase();
    if (!query) return unassignedFields;
    return unassignedFields.filter(
      (f) => displayLabel(f).toLowerCase().includes(query) || f.tableName.toLowerCase().includes(query) || f.columnName.toLowerCase().includes(query),
    );
  }, [unassignedFields, fieldSearch]);

  function assignToShelf(field: Field, shelfId: ShelfId) {
    if (shelfId === 'filters') {
      const placedField: Field = { ...field, aggregation: undefined, filter: field.filter ?? defaultFilterValue(field.dtype) };
      setShelves((prev) => ({ ...prev, filters: [...prev.filters, placedField] }));
      return;
    }
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

  function updateFilter(fieldId: string, filter: FilterValue) {
    setShelves((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.id === fieldId ? { ...f, filter } : f)),
    }));
  }

  async function handleRename(field: Field, newLabel: string) {
    try {
      await apiClient.put(`/ingestion/tables/${field.tableName}/columns/${field.columnName}/label`, { label: newLabel });
      setSchemaFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, label: newLabel } : f)));
      setShelves((prev) => {
        const updated = { ...prev };
        for (const shelfId of Object.keys(updated) as ShelfId[]) {
          updated[shelfId] = updated[shelfId].map((f) => (f.id === field.id ? { ...f, label: newLabel } : f));
        }
        return updated;
      });
    } catch {
      setError('Échec du renommage du champ.');
    }
  }

  function handleEditCalculatedField(field: Field) {
    const existing = calculatedFields.find((f) => f.id === field.columnName);
    if (existing) {
      setSimpleCondition(emptySimpleCondition());
      setEditingCalculatedField(existing);
    }
  }

  function handleSaveCalculatedField(field: CalculatedField) {
    setCalculatedFields((prev) => (prev.some((f) => f.id === field.id) ? prev.map((f) => (f.id === field.id ? field : f)) : [...prev, field]));
    // The label may have changed — keep any shelf placements of this field in sync.
    setShelves((prev) => {
      const updated = { ...prev };
      for (const shelfId of Object.keys(updated) as ShelfId[]) {
        updated[shelfId] = updated[shelfId].map((f) =>
          f.tableName === CALCULATED_FIELD_TABLE && f.columnName === field.id ? { ...f, label: field.label, dtype: field.dtype } : f,
        );
      }
      return updated;
    });
    setEditingCalculatedField(null);
  }

  function handleDeleteCalculatedField(fieldId: string) {
    setCalculatedFields((prev) => prev.filter((f) => f.id !== fieldId));
    setShelves((prev) => {
      const updated = { ...prev };
      for (const shelfId of Object.keys(updated) as ShelfId[]) {
        updated[shelfId] = updated[shelfId].filter((f) => !(f.tableName === CALCULATED_FIELD_TABLE && f.columnName === fieldId));
      }
      return updated;
    });
    setEditingCalculatedField(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const field = event.active.data.current?.field as Field | undefined;
    const overId = event.over?.id as string | undefined;
    if (!field || !overId) return;

    if (overId === CONDITION_FIELD_DROP_ID) {
      setSimpleCondition((prev) => ({ ...prev, fieldId: field.id }));
      return;
    }
    assignToShelf(field, overId as ShelfId);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const stripId = (fields: Field[]) => fields.map(({ tableName, columnName, aggregation }) => ({ tableName, columnName, aggregation }));
      const stripFilterId = (fields: Field[]): FilterCondition[] =>
        fields.map(({ tableName, columnName, filter }) => ({
          tableName,
          columnName,
          operator: filter?.operator ?? 'eq',
          value: filter?.value ?? null,
          value2: filter?.value2 ?? null,
        }));
      const payload = {
        name,
        chartType: activeChartType,
        shelves: {
          rows: stripId(shelves.rows),
          columns: stripId(shelves.columns),
          color: stripId(shelves.color),
          size: stripId(shelves.size),
          filters: stripFilterId(shelves.filters),
        },
        calculatedFields,
      };
      if (isEditing) {
        await apiClient.put(`/views/${id}`, payload);
        navigate(`/views/${id}`);
      } else {
        await apiClient.post('/views', payload);
        navigate('/views');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde de la vue.');
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
          <div className="fields-column">
            <div className="calculated-field-section">
              <div className="page-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSimpleCondition(emptySimpleCondition());
                    setEditingCalculatedField('new');
                  }}
                >
                  + Champ calculé
                </button>
              </div>

              {editingCalculatedField && (
                <CalculatedFieldEditor
                  availableFields={schemaFields}
                  editing={editingCalculatedField === 'new' ? null : editingCalculatedField}
                  simpleCondition={simpleCondition}
                  onSimpleConditionChange={setSimpleCondition}
                  onSave={handleSaveCalculatedField}
                  onDelete={handleDeleteCalculatedField}
                  onCancel={() => setEditingCalculatedField(null)}
                />
              )}
            </div>

            <aside aria-label="Champs disponibles">
              <h2>Champs</h2>
              <label htmlFor="field-search" className="visually-hidden">
                Rechercher un champ
              </label>
              <input
                id="field-search"
                type="search"
                placeholder="Rechercher un champ…"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
              />

              {visibleFields.map((field) => (
                <FieldChip
                  key={field.id}
                  field={fieldById[field.id]}
                  onAddToShelf={(shelfId) => assignToShelf(field, shelfId)}
                  onRename={handleRename}
                  onEditCalculatedField={handleEditCalculatedField}
                />
              ))}
              {fieldSearch && visibleFields.length === 0 && <p>Aucun champ ne correspond à « {fieldSearch} ».</p>}
            </aside>
          </div>
          <div className="shelves">
            {SHELVES.map((shelf) => (
              <ShelfDropZone
                key={shelf.id}
                id={shelf.id}
                label={shelf.label}
                fields={shelves[shelf.id]}
                onRemove={(fieldId) => removeFromShelf(shelf.id, fieldId)}
                onAggregationChange={(fieldId, aggregation) => updateAggregation(shelf.id, fieldId, aggregation)}
                onFilterChange={updateFilter}
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
