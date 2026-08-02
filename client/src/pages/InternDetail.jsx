import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, FileText, User, History, Mail, Phone, MapPin,
  GraduationCap, Building2, CalendarRange, Award, Star, IdCard, UserCog,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, formatDateTime, relativeDays, STATUS_CLASS } from '../lib/format.js';
import {
  Card, CardHeader, Button, Pill, Tabs, Skeleton, ErrorState, ConfirmDialog, EmptyState, Avatar,
} from '../components/ui/index.jsx';
import DocumentsPanel from '../components/DocumentsPanel.jsx';

function Detail({ icon: Icon, label, value, mono = false }) {
  return (
    <div>
      <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div
        style={{
          fontSize: 14.5,
          color: value ? 'var(--text)' : 'var(--text-muted)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function DetailGroup({ title, children }) {
  return (
    <Card className="mb-3">
      <CardHeader title={title} />
      <div className="card-pad">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))' }}>
          {children}
        </div>
      </div>
    </Card>
  );
}

function Timeline({ internId }) {
  const { data, loading } = useApi(`/interns/${internId}/timeline`);

  if (loading) return <Skeleton h={160} />;
  const rows = data?.rows ?? [];
  if (!rows.length) {
    return <EmptyState icon={History} title="No activity recorded" description="Changes to this record will appear here." />;
  }

  const VERB = {
    create: 'created this record',
    update: 'updated this record',
    upload: 'uploaded a document',
    delete: 'deleted a document',
    restore: 'restored this record',
  };

  return (
    <div className="grid gap-0">
      {rows.map((row, i) => {
        let details = null;
        try {
          details = row.details_json ? JSON.parse(row.details_json) : null;
        } catch {
          details = null;
        }
        const changed = details?.changes ? Object.keys(details.changes) : [];

        return (
          <div key={row.id} className="flex gap-3" style={{ padding: '11px 0' }}>
            <div className="flex flex-col items-center" style={{ width: 22 }}>
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i === 0 ? 'var(--primary)' : 'var(--hairline-strong)',
                  marginTop: 5, flexShrink: 0,
                }}
              />
              {i < rows.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--hairline)', marginTop: 4 }} />}
            </div>

            <div className="min-w-0 flex-1" style={{ paddingBottom: 4 }}>
              <div style={{ fontSize: 14 }}>
                <strong style={{ fontWeight: 600 }}>{row.username || 'Someone'}</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{VERB[row.action] ?? row.action}</span>
                {details?.files?.length ? (
                  <span style={{ color: 'var(--text-secondary)' }}> — {details.files.join(', ')}</span>
                ) : null}
                {details?.original_name ? (
                  <span style={{ color: 'var(--text-secondary)' }}> — {details.original_name}</span>
                ) : null}
              </div>

              {changed.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {changed.slice(0, 8).map((field) => (
                    <span key={field} className="pill pill-neutral" style={{ fontSize: 11.5 }}>
                      {field.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {changed.length > 8 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                      +{changed.length - 8} more
                    </span>
                  )}
                </div>
              )}

              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                {formatDateTime(row.at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InternDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, loading, error, reload } = useApi(`/interns/${id}`);
  const intern = data?.intern;

  const remove = async () => {
    await api.del(`/interns/${id}`);
    toast.success('Internee record removed');
    navigate('/interns');
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (loading || !intern) {
    return (
      <Card className="card-pad">
        <Skeleton h={110} />
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4 no-print">
        <Link to="/interns" className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} /> All internees
        </Link>
      </div>

      {/* ---- hero ---- */}
      <Card className="mb-3">
        <div className="card-pad">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar
              internId={intern.id}
              photoPath={intern.photo_path}
              name={intern.full_name}
              size={76}
              radius={18}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 style={{ fontSize: 23, fontWeight: 650, letterSpacing: '-0.02em' }}>{intern.full_name}</h1>
                <Pill tone={STATUS_CLASS[intern.status]?.replace('pill-', '')} dot>
                  {intern.status}
                </Pill>
                {intern.certificate_issued ? (
                  <Pill tone="completed">
                    <Award size={11} /> Certificate issued
                  </Pill>
                ) : null}
              </div>

              <div
                className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5"
                style={{ fontSize: 13.5, color: 'var(--text-muted)' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)' }}>{intern.intern_code}</span>
                {intern.university_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap size={12} /> {intern.university_short || intern.university_name}
                  </span>
                )}
                {intern.department_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={12} /> {intern.department_name}
                  </span>
                )}
                {intern.city_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={12} /> {intern.city_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap mt-3">
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                    Joined
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 550 }}>{formatDate(intern.joining_date)}</div>
                </div>
                <div style={{ width: 1, height: 26, background: 'var(--hairline)' }} />
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                    Ends
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 550 }}>
                    {formatDate(intern.end_date)}
                    {intern.end_date && ['Active', 'Extended'].includes(intern.status) && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {relativeDays(intern.end_date)}</span>
                    )}
                  </div>
                </div>
                {intern.duration_weeks && (
                  <>
                    <div style={{ width: 1, height: 26, background: 'var(--hairline)' }} />
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                        Duration
                      </div>
                      <div className="tnum" style={{ fontSize: 14, fontWeight: 550 }}>{intern.duration_weeks} weeks</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-2 no-print">
                <Link to={`/interns/${id}/edit`} className="btn btn-secondary">
                  <Pencil size={15} /> Edit
                </Link>
                <Button icon={Trash2} onClick={() => setConfirmDelete(true)} title="Remove internee"
                  style={{ color: 'var(--danger-text)' }} />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'profile', label: 'Profile', icon: User },
          { value: 'documents', label: 'Documents', icon: FileText, count: intern.document_count },
          { value: 'timeline', label: 'Timeline', icon: History },
        ]}
      />

      {tab === 'profile' && (
        <>
          <DetailGroup title="Personal">
            <Detail icon={User} label="Father's name" value={intern.father_name} />
            <Detail icon={IdCard} label="CNIC" value={intern.cnic} mono />
            <Detail label="Gender" value={intern.gender} />
            <Detail label="Date of birth" value={intern.dob ? formatDate(intern.dob) : null} />
          </DetailGroup>

          <DetailGroup title="Contact">
            <Detail icon={Phone} label="Phone" value={intern.phone} />
            <Detail icon={Mail} label="Email" value={intern.email} />
            <Detail icon={MapPin} label="Home city" value={intern.city_name} />
            <Detail label="Province" value={intern.city_province} />
            <Detail label="Address" value={intern.address} />
            <Detail label="Emergency contact" value={intern.emergency_contact_name} />
            <Detail label="Emergency phone" value={intern.emergency_contact_phone} />
            <Detail label="Referred by" value={intern.referred_by} />
          </DetailGroup>

          <DetailGroup title="Education">
            <Detail icon={GraduationCap} label="University" value={intern.university_name} />
            <Detail label="Degree" value={intern.degree_name} />
            <Detail label="Level" value={intern.degree_level} />
            <Detail label="Major" value={intern.major} />
            <Detail label="Semester" value={intern.semester} />
            <Detail label="CGPA" value={intern.cgpa ? Number(intern.cgpa).toFixed(2) : null} />
            <Detail label="Enrollment no" value={intern.enrollment_no} mono />
          </DetailGroup>

          <DetailGroup title="Placement">
            <Detail icon={Building2} label="Department" value={intern.department_name} />
            <Detail icon={UserCog} label="Supervisor" value={intern.supervisor_name} />
            <Detail label="Designation" value={intern.supervisor_designation} />
          </DetailGroup>

          <DetailGroup title="Internship period">
            <Detail icon={CalendarRange} label="Joining date" value={formatDate(intern.joining_date)} />
            <Detail label="End date" value={intern.end_date ? formatDate(intern.end_date) : null} />
            <Detail label="Duration" value={intern.duration_weeks ? `${intern.duration_weeks} weeks` : null} />
            <Detail label="Status" value={intern.status} />
          </DetailGroup>

          <DetailGroup title="Completion">
            <Detail icon={Award} label="Certificate" value={intern.certificate_issued ? 'Issued' : 'Not issued'} />
            <Detail label="Certificate date" value={intern.certificate_date ? formatDate(intern.certificate_date) : null} />
            <Detail label="Certificate no" value={intern.certificate_no} mono />
            <Detail
              icon={Star}
              label="Evaluation"
              value={intern.evaluation_rating ? `${intern.evaluation_rating} / 5` : null}
            />
          </DetailGroup>

          {(intern.evaluation_remarks || intern.notes) && (
            <Card className="mb-3">
              <CardHeader title="Remarks" />
              <div className="card-pad grid gap-4">
                {intern.evaluation_remarks && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>Supervisor remarks</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                      {intern.evaluation_remarks}
                    </p>
                  </div>
                )}
                {intern.notes && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>Internal notes</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{intern.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '0 2px 8px' }}>
            Entered by {intern.created_by_name || 'unknown'} on {formatDateTime(intern.created_at)}
            {intern.updated_at && ` · last updated by ${intern.updated_by_name || 'unknown'} on ${formatDateTime(intern.updated_at)}`}
          </div>
        </>
      )}

      {tab === 'documents' && (
        <Card className="card-pad">
          <DocumentsPanel internId={id} onChange={reload} />
        </Card>
      )}

      {tab === 'timeline' && (
        <Card>
          <CardHeader title="Activity" subtitle="Every change made to this record, most recent first." />
          <div className="card-pad">
            <Timeline internId={id} />
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Remove this internee?"
        message={`${intern.full_name} (${intern.intern_code}) will be removed from the list. An administrator can restore the record later — nothing is permanently erased.`}
        confirmLabel="Remove"
      />
    </>
  );
}
