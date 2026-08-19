import { useState, useMemo } from 'react';
import { Download, Printer, Columns3, FileBarChart } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../context/FilterContext.jsx';
import { qs, downloadFile } from '../api/client.js';
import { num, formatDate } from '../lib/format.js';
import {
  Card, CardHeader, Button, PageHeader, Skeleton, EmptyState, Modal, Checkbox, Select, Avatar,
} from '../components/ui/index.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ReportCatalogue from '../components/ReportCatalogue.jsx';
import { BreakdownBar } from '../charts/index.jsx';

const DEFAULT_COLUMNS = [
  'intern_code', 'full_name', 'university_name', 'degree_name',
  'department_name', 'city_name', 'joining_date', 'end_date', 'status',
];

const SUMMARY_DIMENSIONS = [
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

export default function Reports() {
  const { params } = useFilters();
  const [selected, setSelected] = useState(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [dimension, setDimension] = useState('university');

  const available = useApi('/reports/columns');
  const report = useApi(`/reports/interns${qs(params)}`);
  const summary = useApi(`/analytics/breakdown${qs({ ...params, dimension, limit: 100 })}`);

  const columns = useMemo(
    () => (available.data?.columns ?? []).filter((c) => selected.includes(c.key)),
    [available.data, selected],
  );

  const rows = report.data?.rows ?? [];

  const toggleColumn = (key) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const renderCell = (row, key) => {
    const value = row[key];
    if (value == null || value === '') return '—';
    if (key === 'certificate_issued') return value ? 'Yes' : 'No';
    if (key.endsWith('_date') || key === 'dob') return formatDate(value);
    if (key === 'created_at') return formatDate(String(value).slice(0, 10));
    return String(value);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Produce an official PDF report, or build a filtered list and export it."
        actions={
          <>
            <Button icon={Columns3} onClick={() => setColumnsOpen(true)}>
              Columns ({selected.length})
            </Button>
            <Button icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="primary"
              icon={Download}
              onClick={() =>
                downloadFile(
                  `/reports/interns.csv${qs({ ...params, columns: selected.join(',') })}`,
                  'OGDC-Internees.csv',
                )
              }
            >
              Export CSV
            </Button>
          </>
        }
      />

      <FilterBar showSearch />

      {/* ---- official PDF reports ----
          Above the ad-hoc builder: these are the documents management asks for,
          and they inherit whatever the filter bar above is set to. */}
      <ReportCatalogue className="mb-3" />

      {/* ---- summary by dimension ---- */}
      <Card className="mb-3">
        <CardHeader
          title="Summary"
          subtitle="Counts for the filtered population, grouped by the dimension you choose."
          actions={
            <div className="flex items-center gap-2 no-print">
              <Select
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
                options={SUMMARY_DIMENSIONS}
                className="select-sm" style={{ width: 170 }}
                aria-label="Group by"
              />
              <Button
                size="sm"
                variant="ghost"
                icon={Download}
                title="Download this summary"
                onClick={() =>
                  downloadFile(
                    `/reports/breakdown.csv${qs({ ...params, dimension, limit: 100 })}`,
                    `${dimension}-summary.csv`,
                  )
                }
              />
            </div>
          }
        />
        <div className="chart-with-table">
          <div className="p-4">
            {summary.loading ? <Skeleton h={260} /> : <BreakdownBar rows={summary.data?.rows ?? []} maxRows={12} />}
          </div>
          <div className="table-scroll" style={{ maxHeight: 430 }}>
            {/* Table view alongside the chart -- the accessibility fallback and
                the thing people actually copy figures out of. */}
            <table className="table table-compact table-fixed">
              <thead>
                <tr>
                  <th>{summary.data?.label ?? 'Group'}</th>
                  <th style={{ textAlign: 'right', width: 58 }}>Total</th>
                  <th style={{ textAlign: 'right', width: 64 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {(summary.data?.rows ?? []).map((row) => (
                  <tr key={row.label}>
                    <td className="col-primary">
                      <span className="truncate-1 block" title={row.label}>
                        {row.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{num(row.total)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{row.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ---- detail table ---- */}
      <Card>
        <CardHeader
          title="Ad-hoc internee list"
          subtitle={
            report.loading
              ? 'Loading…'
              : `${num(rows.length)} record${rows.length === 1 ? '' : 's'} — choose columns and export to CSV, or print this page`
          }
        />
        {report.loading ? (
          <div className="card-pad">
            <Skeleton h={280} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No records match these filters" description="Adjust the filters above." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'right' }}>#</th>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                    {columns.map((col) =>
                      col.key === 'full_name' ? (
                        <td key={col.key} className="col-primary">
                          <span className="flex items-center gap-2">
                            {/* Hidden in print -- a handout wants names, not thumbnails. */}
                            <span className="no-print flex">
                              <Avatar
                                internId={row.id}
                                photoPath={row.photo_path}
                                name={row.full_name}
                                size={24}
                              />
                            </span>
                            {row.full_name}
                          </span>
                        </td>
                      ) : (
                        <td key={col.key}>{renderCell(row, col.key)}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Choose columns"
        subtitle="Applies to the table below and to the CSV export."
        width={560}
        footer={
          <>
            <Button onClick={() => setSelected(DEFAULT_COLUMNS)}>Reset to default</Button>
            <Button variant="primary" onClick={() => setColumnsOpen(false)}>Done</Button>
          </>
        }
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {(available.data?.columns ?? []).map((col) => (
            <Checkbox
              key={col.key}
              label={col.label}
              checked={selected.includes(col.key)}
              onChange={() => toggleColumn(col.key)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}
