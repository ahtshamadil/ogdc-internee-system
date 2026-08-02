import { useState } from 'react';
import {
  Users as UsersIcon, ListTree, DatabaseBackup, History, Plus, Pencil, KeyRound,
  Download, Trash2, ShieldCheck, Copy, Check, RotateCcw, HardDrive,
} from 'lucide-react';
import { api, downloadFile } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLookups } from '../context/LookupContext.jsx';
import { formatDate, formatDateTime, formatBytes, num } from '../lib/format.js';
import {
  Card, CardHeader, Button, PageHeader, Tabs, Pill, Modal, Field, Input, Select,
  Checkbox, Skeleton, EmptyState, ConfirmDialog,
} from '../components/ui/index.jsx';

/* ==========================================================================
   Users
   ========================================================================== */

function CredentialBox({ username, password }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="px-3.5 py-3 rounded-lg"
      style={{ background: 'var(--primary-tint)', border: '1px solid var(--primary)' }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 7 }}>
        Give these details to the user — the password is shown only once
      </div>
      <div className="flex items-center gap-2">
        <code
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            background: 'var(--surface)',
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid var(--hairline)',
          }}
        >
          {username} / {password}
        </code>
        <Button
          size="sm"
          icon={copied ? Check : Copy}
          onClick={() => {
            navigator.clipboard?.writeText(`${username} / ${password}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function UsersTab() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, reload } = useApi('/users');
  const [editing, setEditing] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const blank = { username: '', full_name: '', role: 'viewer', password: '', is_active: 1 };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing.id) {
        await api.put(`/users/${editing.id}`, editing);
        toast.success('User updated');
      } else {
        const res = await api.post('/users', editing);
        if (res.generated_password) {
          setCredentials({ username: editing.username, password: res.generated_password });
        }
        toast.success('User created');
      }
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (user) => {
    const res = await api.post(`/users/${user.id}/reset-password`);
    setCredentials({ username: user.username, password: res.password });
    toast.success('Password reset');
    reload();
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <Card>
        <CardHeader
          title="User accounts"
          subtitle="Administrators manage everything, HR add and edit internees, viewers can only read."
          actions={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing(blank)}>
              Add user
            </Button>
          }
        />
        {loading ? (
          <div className="card-pad"><Skeleton h={180} /></div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last signed in</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="col-primary">
                      {row.full_name}
                      {row.id === me.id && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> (you)</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{row.username}</td>
                    <td>
                      <Pill tone={row.role === 'admin' ? 'upcoming' : row.role === 'hr' ? 'completed' : 'neutral'}>
                        {ROLE_LABELS[row.role]}
                      </Pill>
                    </td>
                    <td>
                      <Pill tone={row.is_active ? 'active' : 'terminated'} dot>
                        {row.is_active ? 'Active' : 'Deactivated'}
                      </Pill>
                      {!!row.must_change_password && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                          must change password
                        </span>
                      )}
                    </td>
                    <td>{row.last_login_at ? formatDateTime(row.last_login_at) : 'Never'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="inline-flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" icon={Pencil} title="Edit"
                          onClick={() => setEditing({ ...row, password: '' })} />
                        <Button size="sm" variant="ghost" icon={KeyRound} title="Reset password"
                          onClick={() => resetPassword(row)} />
                        {row.id !== me.id && row.is_active && (
                          <Button size="sm" variant="ghost" icon={Trash2} title="Deactivate"
                            style={{ color: 'var(--danger-text)' }}
                            onClick={() => setConfirmDeactivate(row)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit user' : 'Add user'}
        subtitle={editing?.id ? undefined : 'Leave the password blank and one will be generated.'}
        width={470}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {editing?.id ? 'Save' : 'Create user'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4">
            <Field label="Full name" error={errors.full_name} required>
              <Input value={editing.full_name} error={errors.full_name}
                onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
            </Field>
            <Field label="Username" error={errors.username} required hint="Letters, numbers, dot, dash, underscore.">
              <Input value={editing.username} error={errors.username}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
            </Field>
            <Field label="Role" error={errors.role} required>
              <Select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                options={[
                  { value: 'admin', label: 'Administrator — full access' },
                  { value: 'hr', label: 'HR / Data Entry — add and edit internees' },
                  { value: 'viewer', label: 'Viewer — read only' },
                ]} />
            </Field>
            {!editing.id && (
              <Field label="Password" error={errors.password} hint="At least 8 characters, or leave blank to generate one.">
                <Input type="text" value={editing.password} error={errors.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
              </Field>
            )}
            <Checkbox
              checked={!!editing.is_active}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })}
              label="Account is active"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="New password"
        width={470}
        footer={<Button variant="primary" onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials && <CredentialBox {...credentials} />}
      </Modal>

      <ConfirmDialog
        open={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={async () => {
          await api.del(`/users/${confirmDeactivate.id}`);
          toast.success('User deactivated');
          reload();
        }}
        title="Deactivate this user?"
        message={`${confirmDeactivate?.full_name} will no longer be able to sign in. Their name stays on the records they entered.`}
        confirmLabel="Deactivate"
      />
    </>
  );
}

/* ==========================================================================
   Lookups
   ========================================================================== */

const LOOKUP_TABS = [
  { key: 'universities', label: 'Universities', fields: ['name', 'short_name', 'city'] },
  { key: 'degrees', label: 'Degrees', fields: ['name', 'level'] },
  { key: 'departments', label: 'Departments', fields: ['name', 'code'] },
  { key: 'cities', label: 'Cities', fields: ['name', 'province'] },
  { key: 'supervisors', label: 'Supervisors', fields: ['name', 'designation', 'department_id', 'email', 'phone'] },
];

const FIELD_LABELS = {
  name: 'Name', short_name: 'Short name', city: 'City', level: 'Level',
  code: 'Code', province: 'Province', designation: 'Designation',
  department_id: 'Department', email: 'Email', phone: 'Phone',
};

function LookupsTab() {
  const toast = useToast();
  const { departments, refresh } = useLookups();
  const [table, setTable] = useState('universities');
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [saving, setSaving] = useState(false);

  const spec = LOOKUP_TABS.find((t) => t.key === table);
  const { data, loading, reload } = useApi(`/lookups/${table}/all`);

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) await api.put(`/lookups/${table}/${editing.id}`, editing);
      else await api.post(`/lookups/${table}`, editing);
      toast.success('Saved');
      setEditing(null);
      reload();
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <Card className="mb-3">
        <div className="card-pad">
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--info-tint)', color: 'var(--info-text)', fontSize: 13.5 }}
          >
            <ListTree size={14} className="mt-px shrink-0" />
            <span>
              These lists are what the dashboard groups by. Keeping one entry per university (rather than several
              spellings of the same name) is what makes the university-wise and city-wise comparisons trustworthy.
              An entry already in use is deactivated rather than deleted, so past records keep their value.
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={spec.label}
          subtitle={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`}
          actions={
            <div className="flex items-center gap-2">
              <Select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                options={LOOKUP_TABS.map((t) => ({ value: t.key, label: t.label }))}
                className="select-sm" style={{ width: 150 }}
                aria-label="Lookup table"
              />
              <Button variant="primary" size="sm" icon={Plus}
                onClick={() => setEditing(Object.fromEntries([...spec.fields.map((f) => [f, '']), ['is_active', 1]]))}>
                Add
              </Button>
            </div>
          }
        />
        {loading ? (
          <div className="card-pad"><Skeleton h={200} /></div>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 540 }}>
            <table className="table">
              <thead>
                <tr>
                  {spec.fields.map((field) => (
                    <th key={field}>{FIELD_LABELS[field]}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>In use</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {spec.fields.map((field, i) => (
                      <td key={field} className={i === 0 ? 'col-primary' : undefined}>
                        {field === 'department_id'
                          ? departments.find((d) => d.id === row.department_id)?.name || '—'
                          : row[field] || '—'}
                      </td>
                    ))}
                    <td className="tnum" style={{ textAlign: 'right' }}>{num(row.usage_count)}</td>
                    <td>
                      <Pill tone={row.is_active ? 'active' : 'neutral'} dot>
                        {row.is_active ? 'Active' : 'Hidden'}
                      </Pill>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="inline-flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => setEditing(row)} />
                        {row.is_active ? (
                          <Button size="sm" variant="ghost" icon={Trash2} title="Remove or hide"
                            style={{ color: 'var(--danger-text)' }} onClick={() => setConfirmRemove(row)} />
                        ) : (
                          <Button size="sm" variant="ghost" icon={RotateCcw} title="Reactivate"
                            onClick={async () => {
                              await api.put(`/lookups/${table}/${row.id}`, { ...row, is_active: 1 });
                              reload();
                              refresh();
                            }} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${spec.label.toLowerCase().replace(/s$/, '')}` : `Add to ${spec.label.toLowerCase()}`}
        width={470}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4">
            {spec.fields.map((field) => (
              <Field key={field} label={FIELD_LABELS[field]} required={field === 'name'}>
                {field === 'department_id' ? (
                  <Select
                    value={editing.department_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, department_id: e.target.value })}
                    placeholder="No department"
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  />
                ) : (
                  <Input
                    value={editing[field] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const res = await api.del(`/lookups/${table}/${confirmRemove.id}`);
          toast.success(res.deactivated ? 'Hidden — it is still used by existing records' : 'Deleted');
          reload();
          refresh();
        }}
        title={confirmRemove?.usage_count > 0 ? 'Hide this entry?' : 'Delete this entry?'}
        message={
          confirmRemove?.usage_count > 0
            ? `“${confirmRemove?.name}” is used by ${confirmRemove?.usage_count} internee record(s), so it will be hidden from the dropdowns rather than deleted. Existing records keep it.`
            : `“${confirmRemove?.name}” is not used by any record and will be deleted.`
        }
        confirmLabel={confirmRemove?.usage_count > 0 ? 'Hide' : 'Delete'}
      />
    </>
  );
}

/* ==========================================================================
   Backups
   ========================================================================== */

function BackupsTab() {
  const toast = useToast();
  const { data, loading, reload } = useApi('/backups');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.post('/backups');
      toast.success(`Backup created (${formatBytes(res.backup.size_bytes)})`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const backups = data?.backups ?? [];

  return (
    <>
      <Card className="mb-3">
        <CardHeader
          title="Backups"
          subtitle="A backup contains the database and every uploaded document, in one zip file."
          actions={
            <Button variant="primary" size="sm" icon={DatabaseBackup} onClick={create} loading={busy}>
              Create backup now
            </Button>
          }
        />
        <div className="card-pad">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="kpi" style={{ padding: '13px 15px' }}>
              <div className="kpi-label">Internee records</div>
              <div className="kpi-value" style={{ fontSize: 25, marginTop: 5 }}>{num(data?.counts?.interns)}</div>
            </div>
            <div className="kpi" style={{ padding: '13px 15px' }}>
              <div className="kpi-label">Documents stored</div>
              <div className="kpi-value" style={{ fontSize: 25, marginTop: 5 }}>{num(data?.counts?.documents)}</div>
            </div>
            <div className="kpi" style={{ padding: '13px 15px' }}>
              <div className="kpi-label">Backups kept</div>
              <div className="kpi-value" style={{ fontSize: 25, marginTop: 5 }}>{num(backups.length)}</div>
            </div>
          </div>

          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg mt-3"
            style={{ background: 'var(--surface-sunken)', fontSize: 13.5, color: 'var(--text-secondary)' }}
          >
            <HardDrive size={14} className="mt-px shrink-0" />
            <span>
              Data folder: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{data?.dataDir}</code>
              <br />
              Download a backup regularly and keep a copy off this machine — a backup that only exists on the
              server does not survive the server failing.
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Available backups" />
        {loading ? (
          <div className="card-pad"><Skeleton h={120} /></div>
        ) : backups.length === 0 ? (
          <EmptyState
            icon={DatabaseBackup}
            title="No backups yet"
            description="Create one now, and repeat it on a schedule that suits how often the data changes."
            action={<Button variant="primary" icon={DatabaseBackup} onClick={create} loading={busy}>Create backup</Button>}
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Size</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.name}>
                    <td className="col-primary" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {backup.name}
                    </td>
                    <td>{formatDateTime(backup.created_at)}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{formatBytes(backup.size_bytes)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="inline-flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" icon={Download} title="Download"
                          onClick={() => downloadFile(`/backups/${backup.name}`, backup.name)} />
                        <Button size="sm" variant="ghost" icon={Trash2} title="Delete"
                          style={{ color: 'var(--danger-text)' }} onClick={() => setConfirmDelete(backup)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await api.del(`/backups/${confirmDelete.name}`);
          toast.success('Backup deleted');
          reload();
        }}
        title="Delete this backup?"
        message={`${confirmDelete?.name} will be permanently removed from the server.`}
        confirmLabel="Delete"
      />
    </>
  );
}

/* ==========================================================================
   Audit log
   ========================================================================== */

function AuditTab() {
  const { data, loading } = useApi('/users/audit?limit=300');
  const rows = data?.rows ?? [];

  const TONE = {
    create: 'active', update: 'completed', delete: 'terminated',
    login: 'neutral', login_failed: 'terminated', logout: 'neutral',
    upload: 'upcoming', backup: 'upcoming', import: 'upcoming', export: 'neutral',
  };

  return (
    <Card>
      <CardHeader title="Activity log" subtitle="The 300 most recent actions taken in the system." />
      {loading ? (
        <div className="card-pad"><Skeleton h={280} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Nothing recorded yet" />
      ) : (
        <div className="table-scroll" style={{ maxHeight: 620 }}>
          <table className="table table-compact">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>On</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                let details = null;
                try {
                  details = row.details_json ? JSON.parse(row.details_json) : null;
                } catch {
                  details = null;
                }
                return (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.at)}</td>
                    <td className="col-primary">{row.username || '—'}</td>
                    <td>
                      <Pill tone={TONE[row.action] ?? 'neutral'}>{row.action.replace(/_/g, ' ')}</Pill>
                    </td>
                    <td>{row.entity}</td>
                    <td style={{ maxWidth: 340 }}>
                      <span className="truncate-1 block">
                        {details?.intern_code || details?.full_name || details?.username || details?.name ||
                          details?.original_name ||
                          (details?.changes ? `${Object.keys(details.changes).length} field(s) changed` : '') ||
                          (details?.imported != null ? `${details.imported} imported, ${details.skipped} skipped` : '') ||
                          (details?.files ? details.files.join(', ') : '') || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function Admin() {
  const [tab, setTab] = useState('users');

  return (
    <>
      <PageHeader title="Administration" subtitle="Accounts, reference lists, backups and the activity log." />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'users', label: 'Users', icon: UsersIcon },
          { value: 'lookups', label: 'Lookups', icon: ListTree },
          { value: 'backups', label: 'Backups', icon: DatabaseBackup },
          { value: 'audit', label: 'Activity log', icon: History },
        ]}
      />

      {tab === 'users' && <UsersTab />}
      {tab === 'lookups' && <LookupsTab />}
      {tab === 'backups' && <BackupsTab />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}
