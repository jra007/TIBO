import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { CALCULATED_FIELD_TABLE, type FilterCondition, type Group, type SavedView, type TableSchema, type ViewData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { filterStorageKey, loadStoredFilters, storeFilters, type ActiveColumnFilter, type FilterableField } from '../components/column-filters';
import { ExportMenu } from '../components/ExportMenu';
import { ShareControl } from '../components/ShareControl';
import { StatusBadge, type StatusTone } from '../components/StatusBadge';
import { useDateSelection } from '../date-selection/DateSelectionContext';
import { CHART_TYPE_OPTIONS, loadStoredChartType, storeChartType } from './chart-presentation';
import type { ChartType } from './view-builder/suggestChartType';
import { ViewChart } from './view-builder/ViewChart';

function toFilterConditions(activeFilters: ActiveColumnFilter[]): FilterCondition[] {
  return activeFilters
    .filter((f) => f.filter.value !== '')
    .map((f) => ({
      tableName: f.tableName,
      columnName: f.columnName,
      operator: f.filter.operator,
      value: f.filter.value,
      value2: f.filter.value2 ?? null,
    }));
}

const RELATION_STATUS_LABELS: Record<SavedView['relationStatus'], string> = {
  validated: 'Relation validée',
  pending: 'Relation non validée',
  to_fix: 'À corriger',
};

const RELATION_STATUS_TONES: Record<SavedView['relationStatus'], StatusTone> = {
  validated: 'good',
  pending: 'warning',
  to_fix: 'critical',
};

function presentationStorageKey(viewId: string): string {
  return `tibo:view-presentation:${viewId}`;
}

export function ViewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { selectedDate } = useDateSelection();
  const [view, setView] = useState<SavedView | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headerLabels, setHeaderLabels] = useState<Record<string, string>>({});
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sharing, setSharing] = useState(false);
  const [schemaFields, setSchemaFields] = useState<TableSchema[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveColumnFilter[]>([]);

  useEffect(() => {
    if (!id) return;
    setActiveFilters(loadStoredFilters(filterStorageKey(id)));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedDate) return;
    const params = new URLSearchParams({ date: selectedDate });
    const filterConditions = toFilterConditions(activeFilters);
    if (filterConditions.length > 0) params.set('filters', JSON.stringify(filterConditions));
    const dataUrl = `/views/${id}/data?${params.toString()}`;
    Promise.all([apiClient.get<SavedView>(`/views/${id}`), apiClient.get<ViewData>(dataUrl)])
      .then(([viewResult, dataResult]) => {
        setView(viewResult);
        setRows(dataResult.rows);
        setHeaderLabels(Object.fromEntries(dataResult.headers.map((header, i) => [header, dataResult.headerLabels[i]])));
        setChartType(loadStoredChartType(presentationStorageKey(id)) ?? viewResult.chartType);
      })
      .catch(() => setError('Impossible de charger cette vue.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedDate, activeFilters]);

  useEffect(() => {
    apiClient.get<Group[]>('/groups').then(setGroups);
    apiClient.get<TableSchema[]>('/ingestion/tables').then(setSchemaFields);
  }, []);

  const filterableFields = useMemo<FilterableField[]>(() => {
    if (!view) return [];
    const schemaLookup = new Map<string, { dtype: TableSchema['columns'][number]['dtype']; label: string | null }>();
    for (const table of schemaFields) {
      for (const column of table.columns) schemaLookup.set(`${table.tableName}.${column.columnName}`, column);
    }
    const calculatedById = new Map(view.calculatedFields.map((f) => [f.id, f]));
    const refs = [...view.shelves.rows, ...view.shelves.columns, ...view.shelves.color, ...view.shelves.size];
    const seen = new Set<string>();
    const result: FilterableField[] = [];
    for (const ref of refs) {
      const key = `${ref.tableName}.${ref.columnName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (ref.tableName === CALCULATED_FIELD_TABLE) {
        const calculatedField = calculatedById.get(ref.columnName);
        if (calculatedField) result.push({ tableName: ref.tableName, columnName: ref.columnName, dtype: calculatedField.dtype, label: calculatedField.label });
      } else {
        const meta = schemaLookup.get(key);
        result.push({ tableName: ref.tableName, columnName: ref.columnName, dtype: meta?.dtype ?? 'text', label: meta?.label ?? ref.columnName });
      }
    }
    return result;
  }, [view, schemaFields]);

  async function refreshView() {
    if (!id) return;
    setView(await apiClient.get<SavedView>(`/views/${id}`));
  }

  async function handleShare(groupId: string) {
    if (!id) return;
    await apiClient.post(`/views/${id}/share`, { groupId });
    await refreshView();
  }

  async function handleUnshare() {
    if (!id) return;
    await apiClient.post(`/views/${id}/unshare`);
    await refreshView();
  }

  function handleChartTypeChange(next: ChartType) {
    if (!id) return;
    storeChartType(presentationStorageKey(id), next);
    setChartType(next);
  }

  function handleFiltersChange(next: ActiveColumnFilter[]) {
    if (id) storeFilters(filterStorageKey(id), next);
    setActiveFilters(next);
  }

  async function handleExport(format: 'excel' | 'pdf') {
    if (!id || !view) return;
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      const filterConditions = toFilterConditions(activeFilters);
      if (filterConditions.length > 0) params.set('filters', JSON.stringify(filterConditions));
      const query = params.toString();
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      await apiClient.download(`/exports/${format}/${id}${query ? `?${query}` : ''}`, `${view.name}.${extension}`);
    } catch {
      setExportError("Échec de l'export.");
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  }

  if (!view || !chartType) return <p>Chargement…</p>;

  return (
    <section>
      <Link to="/views">← Mes vues</Link>
      <div className="page-header">
        <h1>{view.name}</h1>
        <div className="page-actions">
          {view.ownerId === session?.user.id && (
            <>
              <Link to={`/views/${view.id}/edit`} className="button">
                Modifier
              </Link>
              <button type="button" className="secondary" onClick={() => setSharing((v) => !v)}>
                {sharing ? 'Fermer' : view.visibility === 'shared' ? 'Partagée' : 'Partager'}
              </button>
            </>
          )}
          <ExportMenu onExport={handleExport} disabled={exporting} />
        </div>
      </div>
      {sharing && view.ownerId === session?.user.id && (
        <ShareControl
          idPrefix={`view-${view.id}`}
          itemName={view.name}
          visibility={view.visibility}
          sharedWithGroupId={view.sharedWithGroupId}
          groups={groups}
          onShare={handleShare}
          onUnshare={handleUnshare}
        />
      )}
      {exportError && (
        <p role="alert" className="error">
          {exportError}
        </p>
      )}
      {view.relationStatus !== 'validated' && (
        <output style={{ display: 'block', marginBottom: 12 }}>
          <StatusBadge tone={RELATION_STATUS_TONES[view.relationStatus]}>{RELATION_STATUS_LABELS[view.relationStatus]}</StatusBadge>
        </output>
      )}
      <ColumnFilterBar availableFields={filterableFields} activeFilters={activeFilters} onChange={handleFiltersChange} />
      <div className="presentation-control">
        <label htmlFor="view-chart-type">Mode de présentation</label>
        <select id="view-chart-type" value={chartType} onChange={(e) => handleChartTypeChange(e.target.value as ChartType)}>
          {CHART_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <ViewChart
        chartType={chartType}
        dimensionField={view.shelves.rows[0]}
        measureField={view.shelves.columns[0]}
        colorField={view.shelves.color[0]}
        sizeField={view.shelves.size[0]}
        rows={rows}
        headerLabels={headerLabels}
      />
    </section>
  );
}
