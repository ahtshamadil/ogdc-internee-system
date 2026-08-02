import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, ArrowLeft, User, GraduationCap, Building2, CalendarRange, Award, Phone, Paperclip } from 'lucide-react';
import { api } from '../api/client.js';
import { useLookups } from '../context/LookupContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Card, Button, Field, Input, Select, Textarea, Checkbox, PageHeader, Skeleton, ErrorState } from '../components/ui/index.jsx';
import InternDocumentPicker from '../components/InternDocumentPicker.jsx';

const STATUSES = ['Upcoming', 'Active', 'Completed', 'Extended', 'Terminated'];

const BLANK = {
  full_name: '', father_name: '', cnic: '', gender: '', dob: '',
  phone: '', email: '', address: '', city_id: '',
  emergency_contact_name: '', emergency_contact_phone: '', referred_by: '',
  university_id: '', degree_id: '', major: '', semester: '', cgpa: '', enrollment_no: '',
  department_id: '', supervisor_id: '',
  joining_date: '', end_date: '', status: 'Active',
  certificate_issued: false, certificate_date: '', certificate_no: '',
  evaluation_rating: '', evaluation_remarks: '', notes: '',
};

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card className="mb-3">
      <div className="card-header">
        <div className="flex items-start gap-2.5">
          <div
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--primary-tint)', color: 'var(--primary)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Icon size={15} />
          </div>
          <div>
            <div className="card-title">{title}</div>
            {description && <div className="card-subtitle">{description}</div>}
          </div>
        </div>
      </div>
      <div className="card-pad">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {children}
        </div>
      </div>
    </Card>
  );
}

export default function InternForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { universities, degrees, departments, cities, supervisors } = useLookups();

  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Staged until the record exists -- see InternDocumentPicker.
  const [photo, setPhoto] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [existingCount, setExistingCount] = useState(0);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api
      .get(`/interns/${id}`)
      .then(({ intern }) => {
        const next = { ...BLANK };
        for (const key of Object.keys(BLANK)) {
          const value = intern[key];
          next[key] = key === 'certificate_issued' ? !!value : (value ?? '');
        }
        setForm(next);
        setExistingPhotoUrl(intern.photo_path ? `/api/interns/${id}/photo` : null);
        setExistingCount(intern.document_count ?? 0);
        setLoadError(null);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    // Clear the error as soon as the user edits that field.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Supervisors are filtered to the chosen department so the two can't disagree.
  const availableSupervisors = useMemo(() => {
    if (!form.department_id) return supervisors;
    const matching = supervisors.filter((s) => String(s.department_id) === String(form.department_id));
    return matching.length ? matching : supervisors;
  }, [supervisors, form.department_id]);

  const durationWeeks = useMemo(() => {
    if (!form.joining_date || !form.end_date) return null;
    const ms = Date.parse(form.end_date) - Date.parse(form.joining_date);
    if (Number.isNaN(ms) || ms < 0) return null;
    return Math.max(1, Math.round(ms / (7 * 86400000)));
  }, [form.joining_date, form.end_date]);

  /**
   * Uploads the staged photo and documents against a saved record.
   *
   * Returns the names of anything that failed rather than throwing: the
   * internee record is already saved at this point, and losing that because one
   * attachment was rejected would be far worse than reporting the attachment.
   */
  const uploadStaged = async (internId) => {
    const failed = [];

    const send = async (files, docType) => {
      const body = new FormData();
      body.append('doc_type', docType);
      for (const file of files) body.append('files', file);
      try {
        await api.post(`/interns/${internId}/documents`, body);
      } catch (err) {
        failed.push(`${files.map((f) => f.name).join(', ')} (${err.message})`);
      }
    };

    if (photo) await send([photo], 'photo');

    // Group by type so each type is one request rather than one per file.
    const byType = new Map();
    for (const entry of documents) {
      if (!byType.has(entry.doc_type)) byType.set(entry.doc_type, []);
      byType.get(entry.doc_type).push(entry.file);
    }
    for (const [docType, files] of byType) await send(files, docType);

    return failed;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const payload = { ...form, certificate_issued: form.certificate_issued ? 1 : 0 };
      const { intern } = isEdit
        ? await api.put(`/interns/${id}`, payload)
        : await api.post('/interns', payload);

      const attachmentCount = documents.length + (photo ? 1 : 0);
      const failed = attachmentCount ? await uploadStaged(intern.id) : [];

      if (failed.length) {
        toast.error(`Record saved, but ${failed.length} file could not be uploaded: ${failed.join('; ')}`);
      } else {
        const suffix = attachmentCount
          ? ` with ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`
          : '';
        toast.success(
          isEdit
            ? `Internee record updated${suffix}`
            : `${intern.full_name} added as ${intern.intern_code}${suffix}`,
        );
      }

      navigate(`/interns/${intern.id}`);
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.fields ? 'Please check the highlighted fields' : err.message);
      // Bring the first problem into view rather than leaving the user hunting.
      const firstField = err.fields && Object.keys(err.fields)[0];
      if (firstField) {
        document.querySelector(`[name="${firstField}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorState error={loadError} />;

  if (loading) {
    return (
      <>
        <PageHeader title="Loading…" />
        <Card className="card-pad">
          <Skeleton h={320} />
        </Card>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isEdit ? 'Edit internee' : 'Add internee'}
        subtitle={
          isEdit
            ? 'Update the record. Every change is recorded in the timeline.'
            : 'An internee code is generated automatically once the record is saved.'
        }
        actions={
          <>
            <Link to={isEdit ? `/interns/${id}` : '/interns'} className="btn btn-secondary">
              <ArrowLeft size={15} /> Cancel
            </Link>
            <Button type="submit" variant="primary" icon={Save} loading={saving}>
              {isEdit ? 'Save changes' : 'Create internee'}
            </Button>
          </>
        }
      />

      <Section
        icon={Paperclip}
        title="Photograph and documents"
        description={
          isEdit
            ? 'Add more files to this record. Existing documents stay where they are.'
            : 'Attach them now — they upload automatically as soon as the record is created.'
        }
      >
        <InternDocumentPicker
          photo={photo}
          onPhotoChange={setPhoto}
          documents={documents}
          onDocumentsChange={setDocuments}
          existingPhotoUrl={existingPhotoUrl}
          existingCount={existingCount}
        />
      </Section>

      <Section icon={User} title="Personal details" description="Who the internee is.">
        <Field label="Full name" error={errors.full_name} required className="sm:col-span-2">
          <Input name="full_name" value={form.full_name} onChange={set('full_name')} error={errors.full_name} required placeholder="e.g. Ayesha Khan" />
        </Field>
        <Field label="Father's name" error={errors.father_name}>
          <Input name="father_name" value={form.father_name} onChange={set('father_name')} error={errors.father_name} />
        </Field>
        <Field label="CNIC" error={errors.cnic} hint="13 digits, e.g. 61101-1234567-1">
          <Input name="cnic" value={form.cnic} onChange={set('cnic')} error={errors.cnic} placeholder="61101-1234567-1" />
        </Field>
        <Field label="Gender" error={errors.gender}>
          <Select name="gender" value={form.gender} onChange={set('gender')} placeholder="Not specified"
            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} />
        </Field>
        <Field label="Date of birth" error={errors.dob}>
          <Input name="dob" type="date" value={form.dob} onChange={set('dob')} error={errors.dob} />
        </Field>
      </Section>

      <Section icon={Phone} title="Contact" description="How to reach the internee and their emergency contact.">
        <Field label="Phone" error={errors.phone}>
          <Input name="phone" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="03001234567" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input name="email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        </Field>
        <Field label="Home city" error={errors.city_id}>
          <Select name="city_id" value={form.city_id} onChange={set('city_id')} placeholder="Select a city"
            options={cities.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Referred by" error={errors.referred_by}>
          <Input name="referred_by" value={form.referred_by} onChange={set('referred_by')} error={errors.referred_by} />
        </Field>
        <Field label="Address" error={errors.address} className="sm:col-span-2">
          <Input name="address" value={form.address} onChange={set('address')} error={errors.address} />
        </Field>
        <Field label="Emergency contact name" error={errors.emergency_contact_name}>
          <Input name="emergency_contact_name" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} error={errors.emergency_contact_name} />
        </Field>
        <Field label="Emergency contact phone" error={errors.emergency_contact_phone}>
          <Input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} error={errors.emergency_contact_phone} />
        </Field>
      </Section>

      <Section
        icon={GraduationCap}
        title="Education"
        description="Picked from lists so university and degree comparisons stay accurate."
      >
        <Field label="University" error={errors.university_id} className="sm:col-span-2">
          <Select name="university_id" value={form.university_id} onChange={set('university_id')} placeholder="Select a university"
            options={universities.map((u) => ({ value: u.id, label: u.short_name ? `${u.name} (${u.short_name})` : u.name }))} />
        </Field>
        <Field label="Degree" error={errors.degree_id}>
          <Select name="degree_id" value={form.degree_id} onChange={set('degree_id')} placeholder="Select a degree"
            options={degrees.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="Major / specialisation" error={errors.major}>
          <Input name="major" value={form.major} onChange={set('major')} error={errors.major} />
        </Field>
        <Field label="Semester" error={errors.semester}>
          <Input name="semester" value={form.semester} onChange={set('semester')} error={errors.semester} placeholder="e.g. 7th" />
        </Field>
        <Field label="CGPA" error={errors.cgpa} hint="Out of 4.00">
          <Input name="cgpa" type="number" step="0.01" min="0" max="4" value={form.cgpa} onChange={set('cgpa')} error={errors.cgpa} />
        </Field>
        <Field label="Enrollment number" error={errors.enrollment_no}>
          <Input name="enrollment_no" value={form.enrollment_no} onChange={set('enrollment_no')} error={errors.enrollment_no} />
        </Field>
      </Section>

      <Section icon={Building2} title="Placement" description="Where inside OGDC the internee is working.">
        <Field label="Department" error={errors.department_id}>
          <Select name="department_id" value={form.department_id} onChange={set('department_id')} placeholder="Select a department"
            options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field
          label="Supervisor"
          error={errors.supervisor_id}
          hint={form.department_id ? 'Showing supervisors in the selected department' : undefined}
        >
          <Select name="supervisor_id" value={form.supervisor_id} onChange={set('supervisor_id')} placeholder="Select a supervisor"
            options={availableSupervisors.map((s) => ({ value: s.id, label: s.designation ? `${s.name} — ${s.designation}` : s.name }))} />
        </Field>
      </Section>

      <Section icon={CalendarRange} title="Internship period" description="Dates drive every dashboard comparison.">
        <Field label="Joining date" error={errors.joining_date} required>
          <Input name="joining_date" type="date" value={form.joining_date} onChange={set('joining_date')} error={errors.joining_date} required />
        </Field>
        <Field
          label="End date"
          error={errors.end_date}
          hint={durationWeeks ? `${durationWeeks} week${durationWeeks === 1 ? '' : 's'}` : undefined}
        >
          <Input name="end_date" type="date" value={form.end_date} onChange={set('end_date')} error={errors.end_date} />
        </Field>
        <Field label="Status" error={errors.status} required>
          <Select name="status" value={form.status} onChange={set('status')}
            options={STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>
      </Section>

      <Section icon={Award} title="Completion" description="Filled in when the internship finishes.">
        <Field label="Certificate" className="sm:col-span-2">
          <div style={{ paddingTop: 7 }}>
            <Checkbox
              name="certificate_issued"
              checked={form.certificate_issued}
              onChange={set('certificate_issued')}
              label="Completion certificate has been issued"
            />
          </div>
        </Field>
        <Field label="Certificate date" error={errors.certificate_date}>
          <Input name="certificate_date" type="date" value={form.certificate_date} onChange={set('certificate_date')}
            error={errors.certificate_date} disabled={!form.certificate_issued} />
        </Field>
        <Field label="Certificate number" error={errors.certificate_no}>
          <Input name="certificate_no" value={form.certificate_no} onChange={set('certificate_no')}
            error={errors.certificate_no} disabled={!form.certificate_issued} />
        </Field>
        <Field label="Evaluation rating" error={errors.evaluation_rating} hint="1 (lowest) to 5 (highest)">
          <Select name="evaluation_rating" value={form.evaluation_rating} onChange={set('evaluation_rating')} placeholder="Not evaluated"
            options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} — ${['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n - 1]}` }))} />
        </Field>
        <Field label="Supervisor remarks" error={errors.evaluation_remarks} className="sm:col-span-2" style={{ gridColumn: '1 / -1' }}>
          <Textarea name="evaluation_remarks" value={form.evaluation_remarks} onChange={set('evaluation_remarks')} error={errors.evaluation_remarks} rows={3} />
        </Field>
        <Field label="Internal notes" error={errors.notes} style={{ gridColumn: '1 / -1' }}>
          <Textarea name="notes" value={form.notes} onChange={set('notes')} error={errors.notes} rows={2} />
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-2 pb-4">
        <Link to={isEdit ? `/interns/${id}` : '/interns'} className="btn btn-secondary">Cancel</Link>
        <Button type="submit" variant="primary" icon={Save} loading={saving}>
          {isEdit ? 'Save changes' : 'Create internee'}
        </Button>
      </div>
    </form>
  );
}
