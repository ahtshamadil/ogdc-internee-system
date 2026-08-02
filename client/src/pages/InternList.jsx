import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Users, FileText, Trash2, Pencil, Eye,
} from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { useFilters } from '../context/FilterContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, qs, downloadFile } from '../api/client.js';
import { num, formatDate, STATUS_CLASS } from '../lib/format.js';
import {
  Card, Button, Pill, PageHeader, SkeletonRows, EmptyState, ErrorState, Select, ConfirmDialog, Avatar,
} from '../components/ui/index.jsx';
import FilterBar from '../components/FilterBar.jsx';

const COLUMNS = [
  { key: 'full_name', label: 'Internee', sortable: true, always: true },
  { key: 'intern_code', label: 'Code', sortable: true },
  { key: 'university', label: 'University', sortable: true },
  { key: 'degree', label: 'Degree', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'joining_date', label: 'Joined', sortable: true },
  { key: 'end_date', label: 'Ends', sortable: true },
  { key: 'status', label: 'Status', sortable: true, always: true },
  { key: 'documents', label: 'Docs' },
];

const DEFAULT_VISIBLE = ['full_name', 'intern_code', 'university', 'degree', 'department', 'joining_date', 'status', 'documents'];

export default function InternList() {
  const { params, filters, setFilter } = useFilters();
  const { canEdit } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState('joining_date');
  const [dir, setDir] = useState('desc');
  const [visible, setVisible] = useState(DEFAULT_VISIBLE);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const debouncedSearch = useDebounced(filters.search, 320);
  const query = qs({ ...params, search: debouncedSearch, page, pageSize, sort, dir });
  const { data, loading, error, reload } = useApi(`/interns${query}`);

  const toggleSort = (key) => {
    if (sort === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDir('asc');
    }
    setPage(1);
  };

  const remove = async () => {
    await api.del(`/interns/${confirmDelete.id}`);
    toast.success(`${confirmDelete.full_name} was removed`);
    reload();
  };

  const cols = COLUMNS.filter((c) => visible.includes(c.key) || c.always);
  const rows = data?.rows ?? [];

  const SortIcon = ({ column }) => {
    if (sort !== column) return <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
    return dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  return (
    <>
      <PageHeader
        title="Internees"
        subtitle={data ? `${num(data.total)} record${data.total === 1 ? '' : 's'} match the current filters` : 'Loading…'}
        actions={
          <>
            <Button
              icon={Download}
              onClick={() => downloadFile(`/reports/interns.csv${qs({ ...params, search: debouncedSearch })}`, 'OGDC-Internees.csv')}
            >
              Export
            </Button>
            {canEdit && (
              <Link to="/interns/new" className="btn btn-primary">
                <Plus size={15} /> Add internee
              </Link>
            )}
          </>
        }
      />

      <FilterBar showSearch />

      <Card>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className={col.sortable ? 'th-sortable' : ''}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    style={col.key === 'documents' ? { textAlign: 'center' } : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && <SortIcon column={col.key} />}
                    </span>
                  </th>
                ))}
                <th style={{ width: 96, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>

            {loading ? (
              <SkeletonRows rows={8} cols={cols.length + 1} />
            ) : (
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/interns/${row.id}`)}
                  >
                    {cols.map((col) => {
                      if (col.key === 'full_name') {
                        return (
                          <td key={col.key}>
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                internId={row.id}
                                photoPath={row.photo_path}
                                name={row.full_name}
                                size={30}
                              />
                              <div className="min-w-0">
                                <div className="col-primary truncate-1">{row.full_name}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }} className="truncate-1">
                                  {row.major || row.degree_name || '—'}
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      }
                      if (col.key === 'intern_code') {
                        return (
                          <td key={col.key} style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                            {row.intern_code}
                          </td>
                        );
                      }
                      if (col.key === 'university') {
                        return (
                          <td key={col.key}>
                            <span title={row.university_name}>{row.university_short || row.university_name || '—'}</span>
                          </td>
                        );
                      }
                      if (col.key === 'degree') return <td key={col.key}>{row.degree_name || '—'}</td>;
                      if (col.key === 'department') return <td key={col.key}>{row.department_name || '—'}</td>;
                      if (col.key === 'city') return <td key={col.key}>{row.city_name || '—'}</td>;
                      if (col.key === 'joining_date') return <td key={col.key}>{formatDate(row.joining_date)}</td>;
                      if (col.key === 'end_date') return <td key={col.key}>{formatDate(row.end_date)}</td>;
                      if (col.key === 'status') {
                        return (
                          <td key={col.key}>
                            <Pill tone={STATUS_CLASS[row.status]?.replace('pill-', '')} dot>
                              {row.status}
                            </Pill>
                          </td>
                        );
                      }
                      if (col.key === 'documents') {
                        return (
                          <td key={col.key} style={{ textAlign: 'center' }}>
                            {row.document_count > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 tnum"
                                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                              >
                                <FileText size={12} /> {row.document_count}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        );
                      }
                      return <td key={col.key}>—</td>;
                    })}

                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        <Link to={`/interns/${row.id}`} className="btn btn-ghost btn-sm btn-icon" title="View">
                          <Eye size={14} />
                        </Link>
                        {canEdit && (
                          <>
                            <Link to={`/interns/${row.id}/edit`} className="btn btn-ghost btn-sm btn-icon" title="Edit">
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon"
                              title="Delete"
                              onClick={() => setConfirmDelete(row)}
                              style={{ color: 'var(--danger-text)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {error && <ErrorState error={error} onRetry={reload} />}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={Users}
            title="No internees match these filters"
            description="Try clearing a filter, or add the first internee record."
            action={canEdit && <Link to="/interns/new" className="btn btn-primary"><Plus size={15} /> Add internee</Link>}
          />
        )}

        {/* pagination */}
        {!loading && rows.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
            style={{ borderTop: '1px solid var(--hairline)' }}
          >
            <div className="flex items-center gap-2" style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              <span>
                Showing <strong className="tnum" style={{ color: 'var(--text)' }}>{(data.page - 1) * data.pageSize + 1}</strong>
                –<strong className="tnum" style={{ color: 'var(--text)' }}>{Math.min(data.page * data.pageSize, data.total)}</strong>
                {' of '}
                <strong className="tnum" style={{ color: 'var(--text)' }}>{num(data.total)}</strong>
              </span>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                options={[10, 25, 50, 100].map((n) => ({ value: n, label: `${n} / page` }))}
                className="select-sm"
                style={{ width: 116 }}
                aria-label="Rows per page"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
              <span className="tnum" style={{ fontSize: 13.5, color: 'var(--text-secondary)', padding: '0 6px' }}>
                {data.page} / {data.pageCount}
              </span>
              <Button
                size="sm"
                icon={ChevronRight}
                disabled={page >= data.pageCount}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        title="Remove this internee?"
        message={`${confirmDelete?.full_name} (${confirmDelete?.intern_code}) will be removed from the list. An administrator can restore the record later — nothing is permanently erased.`}
        confirmLabel="Remove"
      />
    </>
  );
}
