import Papa from 'papaparse';
import { get, run, tx } from '../db/index.js';
import { internSchema, weeksBetween } from '../utils/validate.js';
import { nextInternCode } from '../utils/internCode.js';
import { WRITABLE_FIELDS } from './internService.js';

/**
 * CSV import for the spreadsheet HR is already keeping.
 *
 * Lookup columns arrive as names ("NUST", "BS Computer Science"), not ids, so
 * each is resolved against the lookup tables. Unknown names are reported rather
 * than silently created -- auto-creating on import is exactly how "UMT" and
 * "U.M.T" end up as two universities and the analytics stop meaning anything.
 */

export const IMPORT_COLUMNS = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'father_name', label: "Father's Name" },
  { key: 'cnic', label: 'CNIC' },
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'university', label: 'University' },
  { key: 'degree', label: 'Degree' },
  { key: 'major', label: 'Major' },
  { key: 'semester', label: 'Semester' },
  { key: 'cgpa', label: 'CGPA' },
  { key: 'enrollment_no', label: 'Enrollment No' },
  { key: 'department', label: 'Department' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'joining_date', label: 'Joining Date', required: true },
  { key: 'end_date', label: 'End Date' },
  { key: 'status', label: 'Status' },
  { key: 'referred_by', label: 'Referred By' },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone' },
  { key: 'notes', label: 'Notes' },
];

export function importTemplateCsv() {
  return `${IMPORT_COLUMNS.map((c) => c.label).join(',')}\n`;
}

/** Header matching is forgiving about case, spaces, underscores and dashes. */
const normalise = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]+/g, '');

function buildHeaderMap(headers) {
  const map = {};
  for (const header of headers) {
    const n = normalise(header);
    const column = IMPORT_COLUMNS.find((c) => normalise(c.label) === n || normalise(c.key) === n);
    if (column) map[header] = column.key;
  }
  return map;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY and DD-MMM-YYYY, which covers Excel exports. */
function parseDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const named = raw.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})$/);
  if (named) {
    const idx = months.indexOf(named[2].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${named[3]}-${String(idx + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString().slice(0, 10);
}

const lookupId = (table, value) => {
  const name = String(value ?? '').trim();
  if (!name) return { id: null, missing: null };
  const row =
    get(`SELECT id FROM ${table} WHERE name = ? COLLATE NOCASE`, [name]) ??
    (table === 'universities'
      ? get('SELECT id FROM universities WHERE short_name = ? COLLATE NOCASE', [name])
      : null);
  return row ? { id: row.id, missing: null } : { id: null, missing: name };
};

/**
 * Parses and validates without writing anything, so the UI can show exactly
 * what will happen before the user commits.
 */
export function analyseCsv(csvText) {
  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw Object.assign(new Error(`CSV could not be read (row ${first.row + 2}): ${first.message}`), {
      status: 400,
    });
  }

  const headers = parsed.meta.fields ?? [];
  const headerMap = buildHeaderMap(headers);
  const mapped = Object.values(headerMap);

  const missingRequired = IMPORT_COLUMNS.filter((c) => c.required && !mapped.includes(c.key)).map((c) => c.label);
  if (missingRequired.length) {
    throw Object.assign(new Error(`Missing required column(s): ${missingRequired.join(', ')}`), { status: 400 });
  }

  const rows = [];
  const unknownLookups = { universities: new Set(), degrees: new Set(), departments: new Set(), cities: new Set(), supervisors: new Set() };

  parsed.data.forEach((raw, index) => {
    const record = {};
    for (const [header, key] of Object.entries(headerMap)) record[key] = String(raw[header] ?? '').trim();

    const university = lookupId('universities', record.university);
    const degree = lookupId('degrees', record.degree);
    const department = lookupId('departments', record.department);
    const city = lookupId('cities', record.city);
    const supervisor = lookupId('supervisors', record.supervisor);

    if (university.missing) unknownLookups.universities.add(university.missing);
    if (degree.missing) unknownLookups.degrees.add(degree.missing);
    if (department.missing) unknownLookups.departments.add(department.missing);
    if (city.missing) unknownLookups.cities.add(city.missing);
    if (supervisor.missing) unknownLookups.supervisors.add(supervisor.missing);

    const candidate = {
      full_name: record.full_name ?? '',
      father_name: record.father_name ?? '',
      cnic: record.cnic ?? '',
      gender: ['Male', 'Female', 'Other'].find((g) => g.toLowerCase() === (record.gender ?? '').toLowerCase()) ?? '',
      dob: parseDate(record.dob) ?? '',
      phone: record.phone ?? '',
      email: record.email ?? '',
      address: record.address ?? '',
      city_id: city.id,
      emergency_contact_name: record.emergency_contact_name ?? '',
      emergency_contact_phone: record.emergency_contact_phone ?? '',
      referred_by: record.referred_by ?? '',
      university_id: university.id,
      degree_id: degree.id,
      major: record.major ?? '',
      semester: record.semester ?? '',
      cgpa: record.cgpa ?? '',
      enrollment_no: record.enrollment_no ?? '',
      department_id: department.id,
      supervisor_id: supervisor.id,
      joining_date: parseDate(record.joining_date) ?? '',
      end_date: parseDate(record.end_date) ?? '',
      status:
        ['Upcoming', 'Active', 'Completed', 'Terminated', 'Extended'].find(
          (s) => s.toLowerCase() === (record.status ?? '').toLowerCase(),
        ) ?? 'Active',
      certificate_issued: 0,
      notes: record.notes ?? '',
    };

    const result = internSchema.safeParse(candidate);
    const warnings = [];
    for (const [table, info] of Object.entries({ university, degree, department, city, supervisor })) {
      if (info.missing) warnings.push(`Unknown ${table}: "${info.missing}" — will be left blank`);
    }

    // Same name and same joining date almost always means a re-import.
    const duplicate = candidate.full_name && candidate.joining_date
      ? get(
          'SELECT id, intern_code FROM interns WHERE full_name = ? COLLATE NOCASE AND joining_date = ? AND deleted_at IS NULL',
          [candidate.full_name, candidate.joining_date],
        )
      : null;
    if (duplicate) warnings.push(`Looks like a duplicate of ${duplicate.intern_code}`);

    rows.push({
      line: index + 2, // +1 for the header, +1 for 1-based numbering
      data: result.success ? result.data : candidate,
      valid: result.success,
      duplicate: !!duplicate,
      errors: result.success
        ? {}
        : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.') || '_', i.message])),
      warnings,
      preview: {
        full_name: candidate.full_name,
        joining_date: candidate.joining_date,
        university: record.university ?? '',
        degree: record.degree ?? '',
        department: record.department ?? '',
        status: candidate.status,
      },
    });
  });

  return {
    headers,
    mappedColumns: Object.entries(headerMap).map(([header, key]) => ({ header, key })),
    unmappedColumns: headers.filter((h) => !headerMap[h]),
    unknownLookups: Object.fromEntries(Object.entries(unknownLookups).map(([k, v]) => [k, [...v]])),
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((r) => r.valid).length,
      invalid: rows.filter((r) => !r.valid).length,
      duplicates: rows.filter((r) => r.duplicate).length,
    },
  };
}

/** Commits the valid rows. One transaction: all or nothing. */
export function commitImport(rows, userId, { skipDuplicates = true } = {}) {
  const toInsert = rows.filter((r) => r.valid && (!skipDuplicates || !r.duplicate));

  return tx(() => {
    const columns = [...WRITABLE_FIELDS, 'duration_weeks'];
    const created = [];

    for (const row of toInsert) {
      const payload = { ...row.data, duration_weeks: weeksBetween(row.data.joining_date, row.data.end_date) };
      const code = nextInternCode(row.data.joining_date);

      const result = run(
        `INSERT INTO interns (intern_code, ${columns.join(', ')}, created_by, created_at)
         VALUES (?, ${columns.map(() => '?').join(', ')}, ?, datetime('now'))`,
        [code, ...columns.map((c) => payload[c] ?? null), userId ?? null],
      );
      created.push({ id: Number(result.lastInsertRowid), intern_code: code, full_name: row.data.full_name });
    }

    return {
      imported: created.length,
      skipped: rows.length - created.length,
      created,
    };
  });
}
