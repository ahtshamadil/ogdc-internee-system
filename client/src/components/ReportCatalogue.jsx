import { useState, useMemo } from 'react';
import { FileText, Download, Eye, Search, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { useFilters } from '../context/FilterContext.jsx';
import { useLookups } from '../context/LookupContext.jsx';
import { qs, downloadFile } from '../api/client.js';
import { formatDate } from '../lib/format.js';
import { Card, CardHeader, Button, Modal, Select, Input, Pill, Skeleton, EmptyState, Avatar } from './ui/index.jsx';

/**
 * The catalogue of official PDF reports.
 *
 * Collection reports inherit whatever is set on the shared filter bar, so the
 * population a report covers is the population the user is already looking at.
 * Record documents need one internee instead, chosen here.
 */

const GROUP_BY_LABELS = {
  department: 'OGDC Department',
  university: 'University',
  degree: 'Degree',
  city: 'Home city',
  province: 'Province',
  status: 'Status',
  year: 'Joining year',
  supervisor: 'Supervisor',
  none: 'No grouping',
};

const CATEGORY_TONE = {
  Register: 'active',
  'Management summary': 'completed',
  'Exception report': 'extended',
  'Per-record document': 'upcoming',
};

/* -------------------------------------------------------------------------- */
/* Internee picker                                                            */
/* -------------------------------------------------------------------------- */

function InternPicker({ value, onChange }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 300);

  const { data, loading } = useApi(
    `/interns${qs({ search: debounced, pageSize: 8, sort: 'joining_date', dir: 'desc' })}`,
  );
  const rows = data?.rows ?? [];

  if (value) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-md"
        style={{ border: '1px solid var(--hairline)', background: 'var(--surface-sunken)' }}
      >
        <Avatar internId={value.id} photoPath={value.photo_path} name={value.full_name} size={36} />
        <div className="min-w-0 flex-1">
          <div style={{ fontWeight: 600 }}>{value.full_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {value.intern_code} · {value.department_name || 'No department'} · {value.status}
          </div>
        </div>
        <Button size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Input
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search by name, intern code or CNIC…"
        aria-label="Search internees"
      />
      <div
        className="mt-2 rounded-md"
        style={{ border: '1px solid var(--hairline)', maxHeight: 264, overflowY: 'auto' }}
      >
        {loading ? (
          <div className="p-3">
            <Skeleton h={120} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4" style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            No internees match “{debounced}”.
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onChange(row)}
              className="flex items-center gap-3 w-full text-left px-3 py-2"
              style={{ borderBottom: '1px solid var(--hairline)', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar internId={row.id} photoPath={row.photo_path} name={row.full_name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate-1" style={{ fontSize: 14, fontWeight: 550 }}>
                  {row.full_name}
                </span>
                <span className="block" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {row.intern_code} · {row.status} · joined {formatDate(row.joining_date)}
                </span>
              </span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report dialog                                                              */
/* -------------------------------------------------------------------------- */

/** Human-readable description of the filters a collection report will inherit. */
function useFilterSummary(params) {
  const { maps } = useLookups();

  return useMemo(() => {
    const out = [];
    if (params.university_id) out.push(`University: ${maps.universities[params.university_id] ?? '—'}`);
    if (params.degree_id) out.push(`Degree: ${maps.degrees[params.degree_id] ?? '—'}`);
    if (params.department_id) out.push(`Department: ${maps.departments[params.department_id] ?? '—'}`);
    if (params.city_id) out.push(`City: ${maps.cities[params.city_id] ?? '—'}`);
    if (params.status) out.push(`Status: ${params.status}`);
    if (params.gender) out.push(`Gender: ${params.gender}`);
    if (params.from || params.to) {
      out.push(`Joined ${params.from ? formatDate(params.from) : 'earliest'} to ${params.to ? formatDate(params.to) : 'latest'}`);
    }
    if (params.certificate) out.push(`Certificate: ${params.certificate}`);
    if (params.search) out.push(`Search: “${params.search}”`);
    return out;
  }, [params, maps]);
}

function ReportDialog({ report, onClose }) {
  const { params } = useFilters();
  const summary = useFilterSummary(params);

  const [intern, setIntern] = useState(null);
  const [options, setOptions] = useState(() =>
    Object.fromEntries((report?.parameters ?? []).filter((p) => p.default).map((p) => [p.key, p.default])),
  );

  if (!report) return null;

  const isRecord = report.scope === 'record';
  const ready = !isRecord || !!intern;

  // Record documents take only the chosen internee; collection reports inherit
  // the shared filter bar so they cover what the user is already looking at.
  const query = isRecord ? { id: intern?.id } : { ...params, ...options };
  const url = `/api/reports/pdf/${report.id}${qs(query)}`;

  const selects = (report.parameters ?? []).filter((p) => p.type === 'select');

  return (
    <Modal
      open
      onClose={onClose}
      title={report.title}
      subtitle={`${report.code} · ${report.category}`}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            icon={Eye}
            disabled={!ready}
            onClick={() => window.open(url, '_blank', 'noopener')}
            title={ready ? 'Open the PDF in a new tab' : 'Choose an internee first'}
          >
            Preview
          </Button>
          <Button
            variant="primary"
            icon={Download}
            disabled={!ready}
            onClick={() => downloadFile(url.replace(/^\/api/, ''), `${report.id}.pdf`)}
          >
            Download PDF
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        {report.description}
      </p>

      {isRecord ? (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Choose the internee</div>
          <InternPicker value={intern} onChange={setIntern} />
        </div>
      ) : (
        <>
          {selects.map((param) => (
            <div key={param.key} className="mb-4">
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{param.label}</div>
              <Select
                value={options[param.key] ?? param.default ?? ''}
                onChange={(e) => setOptions((o) => ({ ...o, [param.key]: e.target.value }))}
                options={param.options.map((value) => ({ value, label: GROUP_BY_LABELS[value] ?? value }))}
                style={{ maxWidth: 260 }}
              />
            </div>
          ))}

          <div
            className="rounded-md p-3"
            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--hairline)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>
              <SlidersHorizontal size={12} style={{ color: 'var(--text-muted)' }} />
              Selection criteria
            </div>
            {summary.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                All records — no filters applied. Set filters on the page behind this dialog to narrow the report.
              </div>
            ) : (
              <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 16 }}>
                {summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 7 }}>
              These are printed on the face of the report, so the document states the criteria that produced it.
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export default function ReportCatalogue({ className = '' }) {
  const { data, loading } = useApi('/reports/catalogue');
  const [active, setActive] = useState(null);

  const reports = data?.reports ?? [];

  return (
    <Card className={className}>
      <CardHeader
        title="Official reports"
        subtitle="Formatted, paginated PDF documents on OGDC letterhead — each states the criteria that produced it."
      />

      {loading ? (
        <div className="card-pad">
          <Skeleton h={180} />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports available" description="You do not have access to any reports." />
      ) : (
        <div
          className="grid gap-3 card-pad no-print"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))' }}
        >
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => setActive(report)}
              className="text-left rounded-md p-3.5 flex flex-col gap-2"
              style={{
                border: '1px solid var(--hairline)',
                background: 'var(--surface)',
                cursor: 'pointer',
                transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--hairline)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {report.code}
                </span>
                <Pill tone={CATEGORY_TONE[report.category] ?? 'neutral'}>{report.category}</Pill>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{report.title}</div>

              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>
                {report.description}
              </div>

              <div
                className="flex items-center gap-1.5"
                style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 550 }}
              >
                {report.scope === 'record' ? <Search size={12} /> : <FileText size={12} />}
                {report.scope === 'record' ? 'Choose an internee' : 'Produce report'}
                <ChevronRight size={12} />
              </div>
            </button>
          ))}
        </div>
      )}

      {active && <ReportDialog key={active.id} report={active} onClose={() => setActive(null)} />}
    </Card>
  );
}
