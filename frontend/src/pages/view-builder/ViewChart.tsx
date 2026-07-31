import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartType } from './suggestChartType';

interface Field {
  tableName: string;
  columnName: string;
}

// Single-series charts only (one aggregated measure) — series-1 blue from the validated palette.
const SERIES_COLOR = '#2a78d6';
const GRIDLINE_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';

interface ViewChartProps {
  chartType: ChartType;
  dimensionField?: Field;
  measureField?: Field;
  rows: Record<string, unknown>[];
  /** "table.column" -> display label, from GET /views/:id/data's headers/headerLabels. */
  headerLabels?: Record<string, string>;
}

function fieldKey(field: Field): string {
  return `${field.tableName}.${field.columnName}`;
}

function fieldLabel(field: Field, headerLabels: Record<string, string>): string {
  return headerLabels[fieldKey(field)] ?? field.columnName;
}

function aggregateByDimension(rows: Record<string, unknown>[], dimensionKey: string, measureKey: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const dimension = String(row[dimensionKey] ?? '—');
    const measure = Number(row[measureKey]) || 0;
    totals.set(dimension, (totals.get(dimension) ?? 0) + measure);
  }
  return [...totals.entries()].map(([name, value]) => ({ name, value }));
}

function DataTable({ rows, headerLabels }: { rows: Record<string, unknown>[]; headerLabels: Record<string, string> }) {
  if (rows.length === 0) return <p>Aucune donnée.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <table>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {headerLabels[header] ?? header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {headers.map((header) => (
              <td key={header}>{String(row[header] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Simplified rendering: no per-field aggregation config exists yet on shelves, so bar/line/scatter
 * default to summing the first "columns" field grouped by the first "rows" field — correct for the
 * standard 1-dimension + 1-measure case, not a substitute for a real aggregation picker.
 * heatmap/geo have no dedicated visualization yet and fall back to a plain data table.
 */
export function ViewChart({ chartType, dimensionField, measureField, rows, headerLabels = {} }: ViewChartProps) {
  if (chartType === 'table') return <DataTable rows={rows} headerLabels={headerLabels} />;

  if (chartType === 'heatmap' || chartType === 'geo' || !dimensionField || !measureField) {
    return (
      <>
        <p>Aperçu simplifié (tableau) — rendu graphique dédié pour ce type à venir.</p>
        <DataTable rows={rows} headerLabels={headerLabels} />
      </>
    );
  }

  const data = aggregateByDimension(rows, fieldKey(dimensionField), fieldKey(measureField));

  return (
    <>
      <p>
        Agrégation par défaut : somme de « {fieldLabel(measureField, headerLabels)} » par « {fieldLabel(dimensionField, headerLabels)} ».
      </p>
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={SERIES_COLOR} strokeWidth={2} dot={{ r: 4, fill: SERIES_COLOR }} />
          </LineChart>
        ) : (
          <ScatterChart>
            <CartesianGrid stroke={GRIDLINE_COLOR} />
            <XAxis dataKey="name" type="category" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis dataKey="value" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <Tooltip />
            <Scatter data={data} fill={SERIES_COLOR} />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </>
  );
}
