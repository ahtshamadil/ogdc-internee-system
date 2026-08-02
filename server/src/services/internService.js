import { all, get, run, tx } from '../db/index.js';
import { nextInternCode } from '../utils/internCode.js';
import { weeksBetween } from '../utils/validate.js';

/** Columns the client may write. Anything else in the body is ignored. */
export const WRITABLE_FIELDS = [
  'full_name', 'father_name', 'cnic', 'gender', 'dob',
  'phone', 'email', 'address', 'city_id', 'emergency_contact_name',
  'emergency_contact_phone', 'referred_by',
  'university_id', 'degree_id', 'major', 'semester', 'cgpa', 'enrollment_no',
  'department_id', 'supervisor_id',
  'joining_date', 'end_date', 'status',
  'certificate_issued', 'certificate_date', 'certificate_no',
  'evaluation_rating', 'evaluation_remarks', 'notes',
];

/** Joins every lookup so the client never has to resolve ids itself. */
const SELECT_INTERN = `
  SELECT i.*,
         u.name  AS university_name, u.short_name AS university_short,
         d.name  AS degree_name,     d.level      AS degree_level,
         dep.name AS department_name,
         c.name  AS city_name,       c.province   AS city_province,
         s.name  AS supervisor_name, s.designation AS supervisor_designation,
         cu.full_name AS created_by_name,
         uu.full_name AS updated_by_name,
         (SELECT COUNT(*) FROM documents doc WHERE doc.intern_id = i.id) AS document_count
    FROM interns i
    LEFT JOIN universities u  ON u.id  = i.university_id
    LEFT JOIN degrees d       ON d.id  = i.degree_id
    LEFT JOIN departments dep ON dep.id = i.department_id
    LEFT JOIN cities c        ON c.id  = i.city_id
    LEFT JOIN supervisors s   ON s.id  = i.supervisor_id
    LEFT JOIN users cu        ON cu.id = i.created_by
    LEFT JOIN users uu        ON uu.id = i.updated_by
`;

/**
 * Shared WHERE builder. Both the list page and every analytics endpoint use it,
 * so a filter set applied on the dashboard means exactly the same thing on the
 * intern list. Values are always bound, never interpolated.
 */
export function buildFilters(query = {}, { alias = 'i' } = {}) {
  const where = [`${alias}.deleted_at IS NULL`];
  const params = [];

  const eq = (column, value) => {
    if (value === undefined || value === null || value === '') return;
    where.push(`${alias}.${column} = ?`);
    params.push(Number(value));
  };

  eq('university_id', query.university_id);
  eq('degree_id', query.degree_id);
  eq('department_id', query.department_id);
  eq('city_id', query.city_id);
  eq('supervisor_id', query.supervisor_id);

  if (query.status) {
    const statuses = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length) {
      where.push(`${alias}.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
  }

  if (query.gender) {
    where.push(`${alias}.gender = ?`);
    params.push(query.gender);
  }

  if (query.from) {
    where.push(`${alias}.joining_date >= ?`);
    params.push(query.from);
  }
  if (query.to) {
    where.push(`${alias}.joining_date <= ?`);
    params.push(query.to);
  }

  if (query.certificate === 'issued') where.push(`${alias}.certificate_issued = 1`);
  if (query.certificate === 'pending') where.push(`${alias}.certificate_issued = 0`);

  const search = query.search?.trim();
  if (search) {
    where.push(`(
      ${alias}.full_name LIKE ? OR ${alias}.intern_code LIKE ? OR ${alias}.cnic LIKE ?
      OR ${alias}.email LIKE ? OR ${alias}.phone LIKE ? OR ${alias}.enrollment_no LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  return { clause: where.join(' AND '), params };
}

const SORTABLE = {
  full_name: 'i.full_name',
  intern_code: 'i.intern_code',
  joining_date: 'i.joining_date',
  end_date: 'i.end_date',
  status: 'i.status',
  university: 'u.name',
  degree: 'd.name',
  department: 'dep.name',
  city: 'c.name',
  created_at: 'i.created_at',
};

export function listInterns(query = {}) {
  const { clause, params } = buildFilters(query);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(5, Number(query.pageSize) || 25));
  const sortColumn = SORTABLE[query.sort] ?? SORTABLE.joining_date;
  const direction = String(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { total } = get(
    `SELECT COUNT(*) AS total FROM interns i
       LEFT JOIN universities u ON u.id = i.university_id
       LEFT JOIN degrees d ON d.id = i.degree_id
       LEFT JOIN departments dep ON dep.id = i.department_id
       LEFT JOIN cities c ON c.id = i.city_id
      WHERE ${clause}`,
    params,
  );

  const rows = all(
    `${SELECT_INTERN} WHERE ${clause}
      ORDER BY ${sortColumn} ${direction}, i.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Every matching row, unpaginated -- for CSV export and the print report. */
export function listAllInterns(query = {}) {
  const { clause, params } = buildFilters(query);
  return all(`${SELECT_INTERN} WHERE ${clause} ORDER BY i.joining_date DESC, i.id DESC`, params);
}

export function getIntern(id) {
  return get(`${SELECT_INTERN} WHERE i.id = ? AND i.deleted_at IS NULL`, [Number(id)]);
}

export function getInternRaw(id) {
  return get('SELECT * FROM interns WHERE id = ? AND deleted_at IS NULL', [Number(id)]);
}

export function createIntern(data, userId) {
  return tx(() => {
    const code = nextInternCode(data.joining_date);
    const payload = { ...data, duration_weeks: weeksBetween(data.joining_date, data.end_date) };

    const columns = [...WRITABLE_FIELDS, 'duration_weeks'];
    const result = run(
      `INSERT INTO interns (intern_code, ${columns.join(', ')}, created_by, created_at)
       VALUES (?, ${columns.map(() => '?').join(', ')}, ?, datetime('now'))`,
      [code, ...columns.map((c) => payload[c] ?? null), userId ?? null],
    );

    return getIntern(result.lastInsertRowid);
  });
}

export function updateIntern(id, data, userId) {
  const payload = { ...data, duration_weeks: weeksBetween(data.joining_date, data.end_date) };
  const columns = [...WRITABLE_FIELDS, 'duration_weeks'];

  run(
    `UPDATE interns SET ${columns.map((c) => `${c} = ?`).join(', ')},
            updated_by = ?, updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL`,
    [...columns.map((c) => payload[c] ?? null), userId ?? null, Number(id)],
  );

  return getIntern(id);
}

/** Soft delete -- records stay recoverable and keep their documents on disk. */
export function softDeleteIntern(id, userId) {
  return run(
    `UPDATE interns SET deleted_at = datetime('now'), updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
    [userId ?? null, Number(id)],
  );
}

export function restoreIntern(id, userId) {
  return run('UPDATE interns SET deleted_at = NULL, updated_by = ? WHERE id = ?', [userId ?? null, Number(id)]);
}

export function listDeletedInterns() {
  return all(
    `SELECT i.id, i.intern_code, i.full_name, i.joining_date, i.deleted_at, u.name AS university_name
       FROM interns i LEFT JOIN universities u ON u.id = i.university_id
      WHERE i.deleted_at IS NOT NULL ORDER BY i.deleted_at DESC`,
  );
}

export function getInternTimeline(id) {
  return all(
    `SELECT id, username, action, entity, details_json, at
       FROM audit_log
      WHERE (entity = 'intern' AND entity_id = ?)
         OR (entity = 'document' AND json_extract(details_json, '$.intern_id') = ?)
      ORDER BY at DESC, id DESC LIMIT 100`,
    [Number(id), Number(id)],
  );
}
