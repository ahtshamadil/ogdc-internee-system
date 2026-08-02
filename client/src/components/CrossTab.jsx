import { useState } from 'react';
import { Download, Table2 } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../context/FilterContext.jsx';
import { qs, downloadFile } from '../api/client.js';
import { num } from '../lib/format.js';
import { Card, CardHeader, Button, Select, Skeleton, EmptyState } from './ui/index.jsx';

const DIMENSIONS = [
  { value: 'university', label: 'University' },
  { value: 'degree', label: 'Degree' },
  { value: 'department', label: 'Department' },
  { value: 'city', label: 'Home city' },
  { value: 'province', label: 'Province' },
  { value: 'degree_level', label: 'Qualification level' },
  { value: 'status', label: 'Status' },
  { value: 'gender', label: 'Gender' },
  { value: 'year', label: 'Joining year' },
];

/**
 * Any dimension against any other. Cell shading is a single-hue sequential
 * ramp -- magnitude, not identity -- so darker always means more.
 */
export default function CrossTab({ className = '' }) {
  const { params } = useFilters();
  const [rows, setRows] = useState('university');
  const [cols, setCols] = useState('year');

  const query = qs({ ...params, rows, cols });
  const { data, loading } = useApi(`/analytics/matrix${query}`);

  const max = data ? Math.max(1, ...data.rows.flatMap((r) => Object.values(r.cells))) : 1;

  /** Sequential shade by share of the busiest cell. */
  const cellStyle = (value) => {
    if (!value) return { color: 'var(--text-muted)' };
    const ratio = value / max;
    return {
      background: `color-mix(in srgb, var(--seq-400) ${Math.round(9 + ratio * 62)}%, transparent)`,
      color: ratio > 0.55 ? '#fff' : 'var(--text)',
      fontWeight: 600,
      borderRadius: 5,
    };
  };

  return (
    <Card className={className}>
      <CardHeader
        title="Cross-tab comparison"
        subtitle="Count of internees for every combination of the two dimensions."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              options={DIMENSIONS}
              className="select-sm" style={{ width: 150 }}
              aria-label="Row dimension"
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>by</span>
            <Select
              value={cols}
              onChange={(e) => setCols(e.target.value)}
              options={DIMENSIONS}
              className="select-sm" style={{ width: 150 }}
              aria-label="Column dimension"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Download}
              onClick={() => downloadFile(`/reports/matrix.csv${query}`, 'OGDC-crosstab.csv')}
              title="Download as CSV"
            />
          </div>
        }
      />

      {loading ? (
        <div className="card-pad">
          <Skeleton h={220} />
        </div>
      ) : !data?.rows.length ? (
        <EmptyState icon={Table2} title="No data to cross-tabulate" description="Adjust the filters to see results." />
      ) : (
        <div className="table-scroll" style={{ maxHeight: 460 }}>
          <table className="table table-compact">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface)', minWidth: 190 }}>
                  {data.rowLabel}
                </th>
                {data.columns.map((col) => (
                  <th key={col} style={{ textAlign: 'right', minWidth: 74 }}>
                    {col}
                  </th>
                ))}
                <th style={{ textAlign: 'right', minWidth: 74, color: 'var(--text)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.label}>
                  <td
                    className="col-primary"
                    style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', maxWidth: 260 }}
                  >
                    <span className="truncate-1 block" title={row.label}>
                      {row.label}
                    </span>
                  </td>
                  {data.columns.map((col) => {
                    const value = row.cells[col] ?? 0;
                    return (
                      <td key={col} style={{ textAlign: 'right', padding: '6px 8px' }}>
                        <span style={{ ...cellStyle(value), padding: '4px 8px', display: 'inline-block', minWidth: 34 }}>
                          {value || '·'}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right', fontWeight: 650, color: 'var(--text)' }}>{num(row.total)}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-sunken)' }}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: 'var(--surface-sunken)',
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  Total
                </td>
                {data.columns.map((col) => (
                  <td key={col} style={{ textAlign: 'right', fontWeight: 650, color: 'var(--text)' }}>
                    {num(data.columnTotals[col])}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{num(data.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
