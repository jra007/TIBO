import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { SavedView, ViewData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ExportMenu } from '../components/ExportMenu';
import { StatusBadge, type StatusTone } from '../components/StatusBadge';
import { useDateSelection } from '../date-selection/DateSelectionContext';
import { CHART_TYPE_OPTIONS, loadStoredChartType, storeChartType } from './chart-presentation';
import type { ChartType } from './view-builder/suggestChartType';
import { ViewChart } from './view-builder/ViewChart';

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

  useEffect(() => {
    if (!id || !selectedDate) return;
    const dataUrl = `/views/${id}/data?date=${encodeURIComponent(selectedDate)}`;
    Promise.all([apiClient.get<SavedView>(`/views/${id}`), apiClient.get<ViewData>(dataUrl)])
      .then(([viewResult, dataResult]) => {
        setView(viewResult);
        setRows(dataResult.rows);
        setHeaderLabels(Object.fromEntries(dataResult.headers.map((header, i) => [header, dataResult.headerLabels[i]])));
        setChartType(loadStoredChartType(presentationStorageKey(id)) ?? viewResult.chartType);
      })
      .catch(() => setError('Impossible de charger cette vue.'));
  }, [id, selectedDate]);

  function handleChartTypeChange(next: ChartType) {
    if (!id) return;
    storeChartType(presentationStorageKey(id), next);
    setChartType(next);
  }

  async function handleExport(format: 'excel' | 'pdf') {
    if (!id || !view) return;
    setExporting(true);
    setExportError(null);
    try {
      const dateSuffix = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : '';
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      await apiClient.download(`/exports/${format}/${id}${dateSuffix}`, `${view.name}.${extension}`);
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
            <Link to={`/views/${view.id}/edit`} className="button">
              Modifier
            </Link>
          )}
          <ExportMenu onExport={handleExport} disabled={exporting} />
        </div>
      </div>
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
