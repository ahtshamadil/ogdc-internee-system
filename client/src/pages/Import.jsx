import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Info,
} from 'lucide-react';
import { api, downloadFile } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLookups } from '../context/LookupContext.jsx';
import { num, formatDate } from '../lib/format.js';
import { Card, CardHeader, Button, PageHeader, Checkbox, Pill, EmptyState } from '../components/ui/index.jsx';

/**
 * Three-step import: pick a file, review exactly what will happen, then commit.
 * The review step is the point -- a silent import that half-works is much worse
 * than one that refuses and explains itself.
 */
export default function Import() {
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useLookups();

  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);

  const readFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setAnalysis(null);
    setResult(null);

    setBusy(true);
    try {
      setAnalysis(await api.post('/reports/import/analyse', { csv: text }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/reports/import/commit', { csv, skip_duplicates: skipDuplicates });
      setResult(res);
      toast.success(`${res.imported} internee${res.imported === 1 ? '' : 's'} imported`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setCsv('');
    setFileName('');
    setAnalysis(null);
    setResult(null);
  };

  const willImport = analysis
    ? analysis.rows.filter((r) => r.valid && (!skipDuplicates || !r.duplicate)).length
    : 0;

  /* ---------------- after a successful import ---------------- */
  if (result) {
    return (
      <>
        <PageHeader title="Import complete" />
        <Card>
          <div className="card-pad">
            <EmptyState
              icon={CheckCircle2}
              title={`${result.imported} internee${result.imported === 1 ? '' : 's'} imported`}
              description={
                result.skipped
                  ? `${result.skipped} row${result.skipped === 1 ? ' was' : 's were'} skipped because they were invalid or duplicates.`
                  : 'Every row in the file was imported successfully.'
              }
              action={
                <div className="flex items-center gap-2">
                  <Button onClick={startOver}>Import another file</Button>
                  <Button variant="primary" onClick={() => navigate('/interns')} icon={ArrowRight}>
                    View internees
                  </Button>
                </div>
              }
            />
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Import internees"
        subtitle="Bring an existing spreadsheet in. Nothing is saved until you review and confirm."
        actions={
          <Button
            icon={Download}
            onClick={() => downloadFile('/reports/import/template.csv', 'OGDC-Import-Template.csv')}
          >
            Download template
          </Button>
        }
      />

      {/* ---- step 1: choose a file ---- */}
      <Card className="mb-3">
        <CardHeader title="1. Choose a CSV file" subtitle="Export your spreadsheet as CSV first." />
        <div className="card-pad">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInput.current?.click()}
            style={{
              border: `1.5px dashed ${dragging ? 'var(--primary)' : 'var(--hairline-strong)'}`,
              background: dragging ? 'var(--primary-tint)' : 'var(--surface-sunken)',
              borderRadius: 'var(--radius-md)',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.16s ease',
            }}
          >
            <FileSpreadsheet size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 9px' }} />
            <div style={{ fontSize: 14.5, fontWeight: 550 }}>
              {fileName || (
                <>
                  Drop a CSV here, or <span style={{ color: 'var(--primary)' }}>browse</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Column headings are matched by name — Full Name and Joining Date are required
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => readFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          {busy && !analysis && (
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              Checking the file…
            </div>
          )}
        </div>
      </Card>

      {/* ---- step 2: review ---- */}
      {analysis && (
        <>
          <Card className="mb-3">
            <CardHeader title="2. Review what will happen" subtitle="Nothing has been saved yet." />
            <div className="card-pad">
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {[
                  { label: 'Rows in file', value: analysis.summary.total, tone: 'neutral' },
                  { label: 'Ready to import', value: analysis.summary.valid, tone: 'active' },
                  { label: 'Have errors', value: analysis.summary.invalid, tone: 'terminated' },
                  { label: 'Look like duplicates', value: analysis.summary.duplicates, tone: 'extended' },
                ].map((stat) => (
                  <div key={stat.label} className="kpi" style={{ padding: '13px 15px' }}>
                    <div className="kpi-label">{stat.label}</div>
                    <div className="kpi-value" style={{ fontSize: 25, marginTop: 5 }}>
                      {num(stat.value)}
                    </div>
                  </div>
                ))}
              </div>

              {analysis.unmappedColumns.length > 0 && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-2.5"
                  style={{ background: 'var(--info-tint)', color: 'var(--info-text)', fontSize: 13.5 }}
                >
                  <Info size={14} className="mt-px shrink-0" />
                  <span>
                    These columns were not recognised and will be ignored:{' '}
                    <strong>{analysis.unmappedColumns.join(', ')}</strong>
                  </span>
                </div>
              )}

              {Object.entries(analysis.unknownLookups).some(([, list]) => list.length > 0) && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-2.5"
                  style={{ background: 'var(--warning-tint)', color: 'var(--warning-text)', fontSize: 13.5 }}
                >
                  <AlertTriangle size={14} className="mt-px shrink-0" />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>
                      Some names do not match anything on file, and will be left blank
                    </div>
                    {Object.entries(analysis.unknownLookups)
                      .filter(([, list]) => list.length)
                      .map(([table, list]) => (
                        <div key={table} style={{ marginTop: 2 }}>
                          <strong style={{ textTransform: 'capitalize' }}>{table}:</strong> {list.join(', ')}
                        </div>
                      ))}
                    <div style={{ marginTop: 5, opacity: 0.85 }}>
                      Add them under Administration → Lookups first if you want them recorded, so grouping stays
                      accurate.
                    </div>
                  </div>
                </div>
              )}

              <Checkbox
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                label="Skip rows that look like duplicates (same name and joining date as an existing internee)"
              />
            </div>
          </Card>

          <Card className="mb-3">
            <CardHeader title="Row by row" subtitle="The first 100 rows of the file." />
            <div className="table-scroll" style={{ maxHeight: 460 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>Line</th>
                    <th style={{ width: 96 }}>Status</th>
                    <th>Name</th>
                    <th>Joining</th>
                    <th>University</th>
                    <th>Degree</th>
                    <th>Department</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.slice(0, 100).map((row) => {
                    const skipped = skipDuplicates && row.duplicate;
                    const tone = !row.valid ? 'terminated' : skipped ? 'extended' : 'active';
                    const label = !row.valid ? 'Error' : skipped ? 'Skip' : 'Import';
                    const Icon = !row.valid ? XCircle : skipped ? AlertTriangle : CheckCircle2;

                    return (
                      <tr key={row.line}>
                        <td className="tnum" style={{ color: 'var(--text-muted)' }}>{row.line}</td>
                        <td>
                          <Pill tone={tone}>
                            <Icon size={11} /> {label}
                          </Pill>
                        </td>
                        <td className="col-primary">{row.preview.full_name || '—'}</td>
                        <td>{row.preview.joining_date ? formatDate(row.preview.joining_date) : '—'}</td>
                        <td>{row.preview.university || '—'}</td>
                        <td>{row.preview.degree || '—'}</td>
                        <td>{row.preview.department || '—'}</td>
                        <td style={{ maxWidth: 300 }}>
                          {Object.entries(row.errors).map(([field, message]) => (
                            <div key={field} style={{ color: 'var(--danger-text)', fontSize: 12.5 }}>
                              {field.replace(/_/g, ' ')}: {message}
                            </div>
                          ))}
                          {row.warnings.map((warning) => (
                            <div key={warning} style={{ color: 'var(--warning-text)', fontSize: 12.5 }}>
                              {warning}
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {analysis.rows.length > 100 && (
              <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--hairline)' }}>
                Showing the first 100 of {num(analysis.rows.length)} rows. All rows will be processed.
              </div>
            )}
          </Card>

          {/* ---- step 3: commit ---- */}
          <Card>
            <div className="card-pad flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  3. Import {num(willImport)} internee{willImport === 1 ? '' : 's'}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {analysis.summary.total - willImport > 0
                    ? `${num(analysis.summary.total - willImport)} row(s) will be left out.`
                    : 'Every row will be imported.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={startOver} disabled={busy}>Choose a different file</Button>
                <Button variant="primary" icon={Upload} onClick={commit} loading={busy} disabled={!willImport}>
                  Import {num(willImport)}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
