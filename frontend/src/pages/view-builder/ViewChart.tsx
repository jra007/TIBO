import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { ChartType } from './suggestChartType';

interface Field {
  tableName: string;
  columnName: string;
}

// Fixed categorical order from the validated reference palette — never cycled or reassigned by rank.
const CATEGORICAL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const OTHER_SERIES_NAME = 'Autres';
const GRIDLINE_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';

interface ViewChartProps {
  chartType: ChartType;
  dimensionField?: Field;
  measureField?: Field;
  /** Groups bar/line into one series per distinct value (capped, extras folded into "Autres"). Not applied to scatter/table. */
  colorField?: Field;
  /** Scatter only: a second aggregated measure, summed by the same dimension, encoded as point radius. */
  sizeField?: Field;
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

/**
 * One row per dimension value, one numeric field per distinct color value — feeds a grouped
 * Bar/Line series set. Series beyond `maxSeries` fold into a single "Autres" bucket rather than
 * cycling further into the categorical palette (past 8 slots, adjacent hues stop being reliably
 * distinguishable — see the dataviz skill's palette notes).
 */
function aggregateByDimensionAndColor(rows: Record<string, unknown>[], dimensionKey: string, measureKey: string, colorKey: string, maxSeries: number) {
  const seenColors: string[] = [];
  for (const row of rows) {
    const value = String(row[colorKey] ?? '—');
    if (!seenColors.includes(value)) seenColors.push(value);
  }
  const kept = seenColors.slice(0, maxSeries);
  const folded = seenColors.length > maxSeries;
  const seriesNames = folded ? [...kept, OTHER_SERIES_NAME] : kept;

  const byDimension = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const dimension = String(row[dimensionKey] ?? '—');
    const rawColor = String(row[colorKey] ?? '—');
    const seriesName = kept.includes(rawColor) ? rawColor : OTHER_SERIES_NAME;
    const measure = Number(row[measureKey]) || 0;
    const bucket = byDimension.get(dimension) ?? {};
    bucket[seriesName] = (bucket[seriesName] ?? 0) + measure;
    byDimension.set(dimension, bucket);
  }
  const data = [...byDimension.entries()].map(([name, values]) => ({ name, ...values }));
  return { data, seriesNames };
}

/** Merges a second aggregated measure (summed by the same dimension) into the primary data, as "z" — scatter bubble size. */
function mergeSizeByDimension(data: { name: string; value: number }[], rows: Record<string, unknown>[], dimensionKey: string, sizeKey: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const dimension = String(row[dimensionKey] ?? '—');
    const size = Number(row[sizeKey]) || 0;
    totals.set(dimension, (totals.get(dimension) ?? 0) + size);
  }
  return data.map((point) => ({ ...point, z: totals.get(point.name) ?? 0 }));
}

function DataTable({ rows, headerLabels }: { rows: Record<string, unknown>[]; headerLabels: Record<string, string> }) {
  if (rows.length === 0) return <p>Aucune donnée.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="table-scroll">
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
    </div>
  );
}

/**
 * Simplified rendering: no per-field aggregation config exists yet on shelves, so bar/line/scatter
 * default to summing the first "columns" field grouped by the first "rows" field — correct for the
 * standard 1-dimension + 1-measure case, not a substitute for a real aggregation picker.
 * heatmap/geo have no dedicated visualization yet and fall back to a plain data table.
 */
export function ViewChart({ chartType, dimensionField, measureField, colorField, sizeField, rows, headerLabels = {} }: ViewChartProps) {
  if (chartType === 'table') return <DataTable rows={rows} headerLabels={headerLabels} />;

  if (chartType === 'number') {
    const value = measureField && rows.length > 0 ? Number(rows[0][fieldKey(measureField)]) || 0 : null;
    return (
      <div className="kpi-tile">
        <div className="kpi-value">{value === null ? '—' : new Intl.NumberFormat('fr-FR').format(value)}</div>
        {measureField && <div className="kpi-label">{fieldLabel(measureField, headerLabels)}</div>}
      </div>
    );
  }

  if (chartType === 'heatmap' || chartType === 'geo' || !dimensionField || !measureField) {
    return (
      <>
        <p>Aperçu simplifié (tableau) — rendu graphique dédié pour ce type à venir.</p>
        <DataTable rows={rows} headerLabels={headerLabels} />
      </>
    );
  }

  const summaryText = (
    <p>
      Agrégation par défaut : somme de « {fieldLabel(measureField, headerLabels)} » par « {fieldLabel(dimensionField, headerLabels)} »
      {colorField && chartType !== 'scatter' && <>, réparti par « {fieldLabel(colorField, headerLabels)} »</>}
      {sizeField && chartType === 'scatter' && <>, taille des points selon la somme de « {fieldLabel(sizeField, headerLabels)} »</>}.
    </p>
  );

  if (chartType === 'scatter') {
    let data = aggregateByDimension(rows, fieldKey(dimensionField), fieldKey(measureField));
    if (sizeField) data = mergeSizeByDimension(data, rows, fieldKey(dimensionField), fieldKey(sizeField));

    return (
      <>
        {summaryText}
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid stroke={GRIDLINE_COLOR} />
            <XAxis dataKey="name" type="category" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis dataKey="value" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            {sizeField && <ZAxis dataKey="z" range={[64, 400]} />}
            <Tooltip />
            <Scatter data={data} fill={CATEGORICAL_COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </>
    );
  }

  if (colorField) {
    const { data, seriesNames } = aggregateByDimensionAndColor(
      rows,
      fieldKey(dimensionField),
      fieldKey(measureField),
      fieldKey(colorField),
      CATEGORICAL_COLORS.length,
    );

    return (
      <>
        {summaryText}
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
              <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {seriesNames.map((seriesName, i) => (
                <Bar key={seriesName} dataKey={seriesName} fill={CATEGORICAL_COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
              <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {seriesNames.map((seriesName, i) => (
                <Line
                  key={seriesName}
                  type="monotone"
                  dataKey={seriesName}
                  stroke={CATEGORICAL_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CATEGORICAL_COLORS[i] }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </>
    );
  }

  const data = aggregateByDimension(rows, fieldKey(dimensionField), fieldKey(measureField));

  return (
    <>
      {summaryText}
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill={CATEGORICAL_COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={CATEGORICAL_COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: CATEGORICAL_COLORS[0] }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </>
  );
}
