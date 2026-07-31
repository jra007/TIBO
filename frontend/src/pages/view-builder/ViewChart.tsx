import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartType } from './suggestChartType';

interface Field {
  tableName: string;
  columnName: string;
}

interface ViewChartProps {
  chartType: ChartType;
  dimensionField?: Field;
  measureField?: Field;
  rows: Record<string, unknown>[];
}

function fieldKey(field: Field): string {
  return `${field.tableName}.${field.columnName}`;
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

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p>Aucune donnée.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <table>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
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
export function ViewChart({ chartType, dimensionField, measureField, rows }: ViewChartProps) {
  if (chartType === 'table') return <DataTable rows={rows} />;

  if (chartType === 'heatmap' || chartType === 'geo' || !dimensionField || !measureField) {
    return (
      <>
        <p>Aperçu simplifié (tableau) — rendu graphique dédié pour ce type à venir.</p>
        <DataTable rows={rows} />
      </>
    );
  }

  const data = aggregateByDimension(rows, fieldKey(dimensionField), fieldKey(measureField));

  return (
    <>
      <p>
        Agrégation par défaut : somme de « {measureField.columnName} » par « {dimensionField.columnName} ».
      </p>
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" type="category" />
            <YAxis dataKey="value" />
            <Tooltip />
            <Legend />
            <Scatter data={data} fill="#8884d8" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </>
  );
}
