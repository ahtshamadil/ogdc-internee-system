/**
 * Shaped datasets for the official reports.
 *
 * This layer is deliberately free of any rendering concern: every function
 * returns plain objects and arrays, already grouped and already totalled. That
 * is what makes the report catalogue portable -- the same datasets can be
 * handed to the PDF renderer today or pushed into a Crystal Reports service
 * later without the queries being written a second time.
 *
 * Filtering always goes through buildFilters() so a report and the dashboard
 * can never quietly disagree about what "Active in 2026" means.
 */

import { all, get } from '../db/index.js';
import { buildFilters, listAllInterns } from './internService.js';
import { DIMENSION_LABELS } from './analyticsService.js';
import { DOC_TYPE_LABELS } from '../middleware/upload.js';
import { fmtDate } from '../reports/theme.js';

const iso = (d) => d.toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Parameter description                                                      */
/* -------------------------------------------------------------------------- */

const LOOKUP_TABLE = {
  university_id: 'universities',
  degree_id: 'degrees',
  department_id: 'departments',
  city_id: 'cities',
  supervisor_id: 'supervisors',
};

const PARAM_LABEL = {
  university_id: 'University',
  degree_id: 'Degree',
  department_id: 'Department',
  city_id: 'Home city',
  supervisor_id: 'Supervisor',
};

function lookupName(field, id) {
  const table = LOOKUP_TABLE[field];
  if (!table) return String(id);
  const row = get(`SELECT name FROM ${table} WHERE id = ?`, [Number(id)]);
  return row?.name ?? `#${id}`;
}

/**
 * Turns the query string into the label/value pairs printed on the face of the
 * report. Every filter that shaped the data must appear here -- that is the
 * whole point of the block.
 */
export function describeParameters(query = {}) {
  const params = [];

  for (const field of Object.keys(LOOKUP_TABLE)) {
    if (query[field]) params.push({ label: PARAM_LABEL[field], value: lookupName(field, query[field]) });
  }

  if (query.status) params.push({ label: 'Status', value: String(query.status).split(',').join(', ') });
  if (query.gender) params.push({ label: 'Gender', value: query.gender });

  if (query.from || query.to) {
    params.push({
      label: 'Joining date',
      value: `${query.from ? fmtDate(query.from) : 'earliest'} to ${query.to ? fmtDate(query.to) : 'latest'}`,
    });
  }

  if (query.certificate === 'issued') params.push({ label: 'Certificate', value: 'Issued only' });
  if (query.certificate === 'pending') params.push({ label: 'Certificate', value: 'Pending only' });
  if (query.search) params.push({ label: 'Search', value: query.search });

  return params;
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which column of an intern row each grouping dimension reads.
 *
 * Grouping is done in JS rather than SQL because the register needs the full
 * detail rows *and* their subtotals in one pass; re-querying per group would be
 * one round trip per department for no benefit at this data size.
 */
const GROUP_FIELD = {
  department: (r) => r.department_name,
  university: (r) => r.university_name,
  degree: (r) => r.degree_name,
  city: (r) => r.city_name,
  province: (r) => r.city_province,
  supervisor: (r) => r.supervisor_name,
  status: (r) => r.status,
  gender: (r) => r.gender,
  degree_level: (r) => r.degree_level,
  year: (r) => String(r.joining_date ?? '').slice(0, 4),
  none: () => null,
};

export const GROUPABLE = Object.keys(GROUP_FIELD).filter((k) => k !== 'none');

export function groupLabel(dimension) {
  return DIMENSION_LABELS[dimension] ?? (dimension === 'none' ? 'None' : dimension);
}

const UNSPECIFIED = 'Not specified';

/**
 * Splits rows into named groups, each carrying the counts a group footer needs.
 * Groups are ordered by size so the biggest department leads the register.
 */
function groupRows(rows, dimension) {
  const read = GROUP_FIELD[dimension] ?? GROUP_FIELD.department;
  const map = new Map();

  for (const row of rows) {
    const key = read(row) || UNSPECIFIED;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  const groups = [...map.entries()].map(([label, groupRowsList]) => ({
    label,
    rows: groupRowsList,
    total: groupRowsList.length,
    active: groupRowsList.filter((r) => r.status === 'Active' || r.status === 'Extended').length,
    completed: groupRowsList.filter((r) => r.status === 'Completed').length,
    certificates: groupRowsList.filter((r) => r.certificate_issued).length,
  }));

  // "Not specified" is a data-quality signal, not a real group -- it sorts last
  // regardless of size so it never leads the document.
  groups.sort((a, b) => {
    if (a.label === UNSPECIFIED) return 1;
    if (b.label === UNSPECIFIED) return -1;
    return b.total - a.total || a.label.localeCompare(b.label);
  });

  return groups;
}

/* -------------------------------------------------------------------------- */
/* 1. Internee Master Register                                                */
/* -------------------------------------------------------------------------- */

export function masterRegisterData(query = {}) {
  const dimension = GROUP_FIELD[query.group_by] ? query.group_by : 'department';
  const rows = listAllInterns(query);

  // Chronological within a group reads as a joining register; the overall list
  // is newest-first from listAllInterns, which is the wrong order inside a group.
  const sorted = [...rows].sort((a, b) => String(a.joining_date).localeCompare(String(b.joining_date)));

  return {
    dimension,
    dimensionLabel: groupLabel(dimension),
    groups: dimension === 'none' ? [{ label: null, rows: sorted, total: sorted.length }] : groupRows(sorted, dimension),
    grand: {
      total: rows.length,
      active: rows.filter((r) => r.status === 'Active' || r.status === 'Extended').length,
      completed: rows.filter((r) => r.status === 'Completed').length,
      certificates: rows.filter((r) => r.certificate_issued).length,
    },
    parameters: describeParameters(query),
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Internee Profile Sheet  /  3. Completion Certificate                    */
/* -------------------------------------------------------------------------- */

/** Documents an internee file is expected to contain before it is complete. */
const MANDATORY_DOCS = ['joining_letter', 'cnic', 'transcript', 'photo'];

const PROFILE_SELECT = `
  SELECT i.*,
         u.name AS university_name, u.short_name AS university_short,
         d.name AS degree_name, d.level AS degree_level,
         dep.name AS department_name, dep.code AS department_code,
         c.name AS city_name, c.province AS city_province,
         s.name AS supervisor_name, s.designation AS supervisor_designation,
         cu.full_name AS created_by_name
    FROM interns i
    LEFT JOIN universities u  ON u.id  = i.university_id
    LEFT JOIN degrees d       ON d.id  = i.degree_id
    LEFT JOIN departments dep ON dep.id = i.department_id
    LEFT JOIN cities c        ON c.id  = i.city_id
    LEFT JOIN supervisors s   ON s.id  = i.supervisor_id
    LEFT JOIN users cu        ON cu.id = i.created_by
   WHERE i.id = ? AND i.deleted_at IS NULL
`;

/** One intern, with the document checklist that the profile sheet prints. */
export function profileSheetData(internId) {
  const intern = get(PROFILE_SELECT, [Number(internId)]);
  if (!intern) return null;

  const held = all(
    `SELECT doc_type, original_name, size_bytes, uploaded_at
       FROM documents WHERE intern_id = ? ORDER BY uploaded_at DESC`,
    [Number(internId)],
  );

  const heldTypes = new Set(held.map((d) => d.doc_type));

  // The checklist is the point: a profile sheet that lists only what is present
  // cannot be used to chase what is missing.
  const checklist = MANDATORY_DOCS.map((type) => ({
    type,
    label: DOC_TYPE_LABELS[type] ?? type,
    present: heldTypes.has(type),
  }));

  return { intern, documents: held, checklist, missing: checklist.filter((c) => !c.present) };
}

export function completionCertificateData(internId) {
  const intern = get(PROFILE_SELECT, [Number(internId)]);
  if (!intern) return null;
  return { intern };
}

/* -------------------------------------------------------------------------- */
/* 4. Departmental Intake Summary                                             */
/* -------------------------------------------------------------------------- */

/**
 * Department against joining year, with row, column and grand totals.
 *
 * Grouped in SQL, pivoted in JS -- the same trade-off the dashboard's cross-tab
 * makes, and for the same reason: pivoting in SQL means generating a column per
 * year at runtime for no gain at this size.
 */
export function departmentalSummaryData(query = {}) {
  const { clause, params } = buildFilters(query);

  const raw = all(
    `SELECT COALESCE(dep.name, '${UNSPECIFIED}') AS row_label,
            COALESCE(strftime('%Y', i.joining_date), '${UNSPECIFIED}') AS col_label,
            COUNT(*) AS total
       FROM interns i
       LEFT JOIN departments dep ON dep.id = i.department_id
      WHERE ${clause}
      GROUP BY dep.id, strftime('%Y', i.joining_date)`,
    params,
  );

  const columns = [...new Set(raw.map((r) => r.col_label))].sort();
  const rowMap = new Map();
  for (const r of raw) {
    const row = rowMap.get(r.row_label) ?? { label: r.row_label, cells: {}, total: 0 };
    row.cells[r.col_label] = (row.cells[r.col_label] ?? 0) + r.total;
    row.total += r.total;
    rowMap.set(r.row_label, row);
  }

  const rows = [...rowMap.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  const columnTotals = Object.fromEntries(
    columns.map((c) => [c, rows.reduce((sum, r) => sum + (r.cells[c] ?? 0), 0)]),
  );
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  // Status mix per department, printed beside the matrix so the reader can see
  // composition as well as volume.
  const status = all(
    `SELECT COALESCE(dep.name, '${UNSPECIFIED}') AS label,
            SUM(CASE WHEN i.status IN ('Active','Extended') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN i.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN i.status = 'Upcoming' THEN 1 ELSE 0 END) AS upcoming,
            SUM(CASE WHEN i.status = 'Terminated' THEN 1 ELSE 0 END) AS terminated,
            SUM(CASE WHEN i.certificate_issued = 1 THEN 1 ELSE 0 END) AS certificates,
            COUNT(*) AS total
       FROM interns i
       LEFT JOIN departments dep ON dep.id = i.department_id
      WHERE ${clause}
      GROUP BY dep.id
      ORDER BY total DESC`,
    params,
  );

  return { columns, rows, columnTotals, grandTotal, status, parameters: describeParameters(query) };
}

/* -------------------------------------------------------------------------- */
/* 5. Certificate Pending Register                                            */
/* -------------------------------------------------------------------------- */

export function certificatePendingData(query = {}) {
  const { clause, params } = buildFilters(query);

  const rows = all(
    `SELECT i.id, i.intern_code, i.full_name, i.father_name, i.cnic, i.email, i.phone,
            i.joining_date, i.end_date, i.duration_weeks, i.evaluation_rating,
            dep.name AS department_name, u.name AS university_name, s.name AS supervisor_name,
            CAST(julianday('now') - julianday(i.end_date) AS INTEGER) AS days_since_end
       FROM interns i
       LEFT JOIN departments dep ON dep.id = i.department_id
       LEFT JOIN universities u  ON u.id  = i.university_id
       LEFT JOIN supervisors s   ON s.id  = i.supervisor_id
      WHERE ${clause} AND i.status = 'Completed' AND i.certificate_issued = 0
      ORDER BY i.end_date ASC`,
    params,
  );

  return {
    rows,
    groups: groupRows(rows, 'department'),
    total: rows.length,
    // Anything finished more than 30 days ago is genuinely overdue rather than
    // merely awaiting the next certificate run.
    overdue: rows.filter((r) => (r.days_since_end ?? 0) > 30).length,
    parameters: describeParameters(query),
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Data Quality Exception Report                                           */
/* -------------------------------------------------------------------------- */

/**
 * Each check returns the records that fail it, with a plain-language statement
 * of what is wrong and what to do -- an exception report that only lists codes
 * gets ignored.
 */
export function dataQualityData(query = {}) {
  const { clause, params } = buildFilters(query);
  const today = query.as_of || iso(new Date());

  const pick = `i.id, i.intern_code, i.full_name, i.joining_date, i.end_date, i.status,
                dep.name AS department_name, u.name AS university_name`;
  const from = `FROM interns i
                LEFT JOIN departments dep ON dep.id = i.department_id
                LEFT JOIN universities u ON u.id = i.university_id`;

  const checks = [
    {
      key: 'overdue',
      title: 'Past end date but still marked Active',
      action: 'Update the status to Completed, or extend the end date.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause} AND i.status IN ('Active','Extended')
            AND i.end_date IS NOT NULL AND i.end_date < ?
          ORDER BY i.end_date ASC`,
        [...params, today],
      ),
    },
    {
      key: 'certificate',
      title: 'Completed but no certificate recorded',
      action: 'Issue the completion certificate and record its number and date.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause} AND i.status = 'Completed' AND i.certificate_issued = 0
          ORDER BY i.end_date ASC`,
        params,
      ),
    },
    {
      key: 'no_end_date',
      title: 'No end date recorded',
      action: 'Set the end date so the internship duration can be reported.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause} AND i.end_date IS NULL
          ORDER BY i.joining_date DESC`,
        params,
      ),
    },
    {
      key: 'no_placement',
      title: 'No OGDC department or supervisor assigned',
      action: 'Assign the placement so the internee appears in departmental reporting.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause} AND (i.department_id IS NULL OR i.supervisor_id IS NULL)
          ORDER BY i.joining_date DESC`,
        params,
      ),
    },
    {
      key: 'no_cnic',
      title: 'CNIC missing',
      action: 'Record the CNIC - it is the identity reference on official correspondence.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause} AND (i.cnic IS NULL OR TRIM(i.cnic) = '')
          ORDER BY i.joining_date DESC`,
        params,
      ),
    },
    {
      key: 'no_contact',
      title: 'No phone number and no email address',
      action: 'Record at least one means of contact.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause}
            AND (i.phone IS NULL OR TRIM(i.phone) = '')
            AND (i.email IS NULL OR TRIM(i.email) = '')
          ORDER BY i.joining_date DESC`,
        params,
      ),
    },
    {
      key: 'no_documents',
      title: 'No documents on file',
      action: 'Upload the joining letter, CNIC, transcript and photograph.',
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause}
            AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.intern_id = i.id)
          ORDER BY i.joining_date DESC`,
        params,
      ),
    },
    {
      key: 'missing_mandatory',
      title: 'Some documents on file, but mandatory ones missing',
      action: `Complete the file: ${MANDATORY_DOCS.map((t) => DOC_TYPE_LABELS[t]).join(', ')}.`,
      rows: all(
        `SELECT ${pick} ${from}
          WHERE ${clause}
            AND EXISTS (SELECT 1 FROM documents d WHERE d.intern_id = i.id)
            AND (
              SELECT COUNT(DISTINCT d.doc_type) FROM documents d
               WHERE d.intern_id = i.id
                 AND d.doc_type IN (${MANDATORY_DOCS.map(() => '?').join(', ')})
            ) < ?
          ORDER BY i.joining_date DESC`,
        [...params, ...MANDATORY_DOCS, MANDATORY_DOCS.length],
      ),
    },
  ];

  const { total } = get(`SELECT COUNT(*) AS total FROM interns i WHERE ${clause}`, params);

  return {
    checks,
    population: total,
    exceptions: checks.reduce((sum, c) => sum + c.rows.length, 0),
    // Distinct records, since one record can fail several checks at once.
    affected: new Set(checks.flatMap((c) => c.rows.map((r) => r.id))).size,
    parameters: describeParameters(query),
  };
}
