import { all, get } from '../db/index.js';
import { buildFilters } from './internService.js';
import { buildPeriods, PERIOD_LABELS, pctChange, iso } from '../utils/dateRanges.js';

/**
 * Dimensions are looked up in this table rather than taken from the query
 * string, so no user input ever reaches the SQL text.
 */
const DIMENSIONS = {
  university: { join: 'LEFT JOIN universities x ON x.id = i.university_id', label: 'x.name', short: 'x.short_name', key: 'i.university_id' },
  degree: { join: 'LEFT JOIN degrees x ON x.id = i.degree_id', label: 'x.name', short: 'x.name', key: 'i.degree_id' },
  department: { join: 'LEFT JOIN departments x ON x.id = i.department_id', label: 'x.name', short: 'x.code', key: 'i.department_id' },
  city: { join: 'LEFT JOIN cities x ON x.id = i.city_id', label: 'x.name', short: 'x.name', key: 'i.city_id' },
  supervisor: { join: 'LEFT JOIN supervisors x ON x.id = i.supervisor_id', label: 'x.name', short: 'x.name', key: 'i.supervisor_id' },
  status: { join: '', label: 'i.status', short: 'i.status', key: 'i.status' },
  gender: { join: '', label: 'i.gender', short: 'i.gender', key: 'i.gender' },
  year: { join: '', label: "strftime('%Y', i.joining_date)", short: "strftime('%Y', i.joining_date)", key: "strftime('%Y', i.joining_date)" },
  degree_level: { join: 'LEFT JOIN degrees x ON x.id = i.degree_id', label: 'x.level', short: 'x.level', key: 'x.level' },
  province: { join: 'LEFT JOIN cities x ON x.id = i.city_id', label: 'x.province', short: 'x.province', key: 'x.province' },
};

export const DIMENSION_KEYS = Object.keys(DIMENSIONS);

export const DIMENSION_LABELS = {
  university: 'University',
  degree: 'Degree / Major',
  department: 'OGDC Department',
  city: 'Home City',
  supervisor: 'Supervisor',
  status: 'Status',
  gender: 'Gender',
  year: 'Joining Year',
  degree_level: 'Qualification Level',
  province: 'Province',
};

function dimension(name) {
  const dim = DIMENSIONS[name];
  if (!dim) throw Object.assign(new Error(`Unknown dimension: ${name}`), { status: 400 });
  return dim;
}

/* -------------------------------------------------------------------------- */
/* Headline counts                                                            */
/* -------------------------------------------------------------------------- */

export function getTotals(query = {}) {
  const { clause, params } = buildFilters(query);
  const today = query.as_of || iso(new Date());

  const row = get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN i.status = 'Active'
                 AND (i.end_date IS NULL OR i.end_date >= ?) THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN i.status = 'Completed'  THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN i.status = 'Upcoming'   THEN 1 ELSE 0 END) AS upcoming,
       SUM(CASE WHEN i.status = 'Terminated' THEN 1 ELSE 0 END) AS terminated,
       SUM(CASE WHEN i.status = 'Extended'   THEN 1 ELSE 0 END) AS extended,
       SUM(CASE WHEN i.certificate_issued = 1 THEN 1 ELSE 0 END) AS certificates_issued,
       SUM(CASE WHEN i.status = 'Completed' AND i.certificate_issued = 0 THEN 1 ELSE 0 END) AS certificates_pending,
       COUNT(DISTINCT i.university_id) AS universities,
       COUNT(DISTINCT i.department_id) AS departments,
       COUNT(DISTINCT i.city_id) AS cities,
       ROUND(AVG(i.duration_weeks), 1) AS avg_duration_weeks,
       ROUND(AVG(NULLIF(i.cgpa, 0)), 2) AS avg_cgpa
     FROM interns i WHERE ${clause}`,
    [today, ...params],
  );

  // COUNT returns 0 rows -> SUM returns NULL; normalise so the UI never shows "null".
  for (const key of Object.keys(row)) if (row[key] === null && key !== 'avg_duration_weeks' && key !== 'avg_cgpa') row[key] = 0;
  return row;
}

/* -------------------------------------------------------------------------- */
/* Period comparisons                                                         */
/* -------------------------------------------------------------------------- */

/**
 * All five period pairs in a single pass over the table -- one query with ten
 * conditional sums beats ten round trips.
 */
export function getPeriodComparison(query = {}) {
  const today = query.as_of || iso(new Date());
  const likeForLike = query.like_for_like !== 'false';
  const periods = buildPeriods(today, likeForLike);
  const { clause, params } = buildFilters(query);

  const keys = Object.keys(periods);
  const selects = [];
  const bind = [];

  for (const key of keys) {
    const { current, previous } = periods[key];
    selects.push(
      `SUM(CASE WHEN i.joining_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS ${key}_current`,
      `SUM(CASE WHEN i.joining_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS ${key}_previous`,
    );
    bind.push(current.start, current.end, previous.start, previous.end);
  }

  const row = get(`SELECT ${selects.join(', ')} FROM interns i WHERE ${clause}`, [...bind, ...params]);

  return keys.map((key) => {
    const current = row[`${key}_current`] ?? 0;
    const previous = row[`${key}_previous`] ?? 0;
    return {
      key,
      ...PERIOD_LABELS[key],
      current,
      previous,
      change: current - previous,
      pct: pctChange(current, previous),
      range: periods[key],
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Trend over time                                                            */
/* -------------------------------------------------------------------------- */

const GRANULARITY = {
  week: { fmt: '%Y-W%W', step: (d) => d.setUTCDate(d.getUTCDate() + 7) },
  month: { fmt: '%Y-%m', step: (d) => d.setUTCMonth(d.getUTCMonth() + 1) },
  quarter: { fmt: '%Y-%m', step: (d) => d.setUTCMonth(d.getUTCMonth() + 3) },
  year: { fmt: '%Y', step: (d) => d.setUTCFullYear(d.getUTCFullYear() + 1) },
};

export function getTrend(query = {}) {
  const granularity = GRANULARITY[query.granularity] ? query.granularity : 'month';
  const fmt = GRANULARITY[granularity].fmt;
  const { clause, params } = buildFilters(query);

  const joined = all(
    `SELECT strftime(?, i.joining_date) AS bucket, COUNT(*) AS joined
       FROM interns i WHERE ${clause}
      GROUP BY bucket ORDER BY bucket`,
    [fmt, ...params],
  );

  const completed = all(
    `SELECT strftime(?, i.end_date) AS bucket, COUNT(*) AS completed
       FROM interns i
      WHERE ${clause} AND i.end_date IS NOT NULL AND i.status IN ('Completed', 'Terminated')
      GROUP BY bucket ORDER BY bucket`,
    [fmt, ...params],
  );

  const byBucket = new Map();
  for (const r of joined) byBucket.set(r.bucket, { bucket: r.bucket, joined: r.joined, completed: 0 });
  for (const r of completed) {
    const existing = byBucket.get(r.bucket) ?? { bucket: r.bucket, joined: 0, completed: 0 };
    existing.completed = r.completed;
    byBucket.set(r.bucket, existing);
  }

  const rows = [...byBucket.values()].filter((r) => r.bucket).sort((a, b) => a.bucket.localeCompare(b.bucket));

  // Quarter buckets are produced monthly then folded, so a quarter with no
  // joinings in its first month still lands in the right bucket.
  if (granularity === 'quarter') {
    const quarters = new Map();
    for (const r of rows) {
      const [y, m] = r.bucket.split('-').map(Number);
      const key = `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
      const q = quarters.get(key) ?? { bucket: key, joined: 0, completed: 0 };
      q.joined += r.joined;
      q.completed += r.completed;
      quarters.set(key, q);
    }
    return { granularity, rows: [...quarters.values()] };
  }

  return { granularity, rows };
}

/* -------------------------------------------------------------------------- */
/* Breakdown by any dimension                                                 */
/* -------------------------------------------------------------------------- */

export function getBreakdown(query = {}) {
  const name = query.dimension || 'university';
  const dim = dimension(name);
  const { clause, params } = buildFilters(query);
  const today = query.as_of || iso(new Date());
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 100));

  const rows = all(
    `SELECT COALESCE(${dim.label}, 'Not specified') AS label,
            COALESCE(${dim.short}, ${dim.label}, 'Not specified') AS short_label,
            COUNT(*) AS total,
            SUM(CASE WHEN i.status = 'Active'
                      AND (i.end_date IS NULL OR i.end_date >= ?) THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN i.status = 'Completed' THEN 1 ELSE 0 END) AS completed
       FROM interns i ${dim.join}
      WHERE ${clause}
      GROUP BY ${dim.key}
      ORDER BY total DESC, label ASC
      LIMIT ?`,
    [today, ...params, limit],
  );

  // The true population, counted independently of `limit`. Summing the capped
  // rows instead would make every percentage wrong the moment a breakdown is
  // truncated, and would let a chart report a total smaller than reality.
  const { grandTotal, groupCount } = get(
    `SELECT COUNT(*) AS grandTotal, COUNT(DISTINCT ${dim.key}) AS groupCount
       FROM interns i ${dim.join} WHERE ${clause}`,
    params,
  );
  const shownTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return {
    dimension: name,
    label: DIMENSION_LABELS[name] ?? name,
    total: grandTotal,
    // Distinct groups in the whole filtered set, not just the returned page --
    // so a caption can say "34 universities" while the chart shows the top 12.
    groupCount,
    shownTotal,
    // Everything past the limit, so a chart can show an honest "Other" bucket.
    remainder: grandTotal - shownTotal,
    truncated: grandTotal > shownTotal,
    rows: rows.map((r) => ({ ...r, pct: grandTotal ? (r.total / grandTotal) * 100 : 0 })),
  };
}

/* -------------------------------------------------------------------------- */
/* Cross-tab                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Grouped in SQL, pivoted in JS. Pivoting in SQL would mean generating a column
 * per year at runtime -- dynamic SQL for no gain at this data size.
 */
export function getMatrix(query = {}) {
  const rowDim = dimension(query.rows || 'university');
  const colDim = dimension(query.cols || 'year');
  const { clause, params } = buildFilters(query);

  // Both dimensions may want to join the same table; alias them apart.
  const rowJoin = rowDim.join.replace(/\bx\b/g, 'rx');
  const colJoin = colDim.join.replace(/\bx\b/g, 'cx');
  const rowLabel = rowDim.label.replace(/^x\./, 'rx.');
  const colLabel = colDim.label.replace(/^x\./, 'cx.');
  const rowKey = rowDim.key.replace(/^x\./, 'rx.');
  const colKey = colDim.key.replace(/^x\./, 'cx.');

  const raw = all(
    `SELECT COALESCE(${rowLabel}, 'Not specified') AS row_label,
            COALESCE(${colLabel}, 'Not specified') AS col_label,
            COUNT(*) AS total
       FROM interns i ${rowJoin} ${colJoin}
      WHERE ${clause}
      GROUP BY ${rowKey}, ${colKey}`,
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

  const rows = [...rowMap.values()].sort((a, b) => b.total - a.total);
  const columnTotals = Object.fromEntries(
    columns.map((c) => [c, rows.reduce((sum, r) => sum + (r.cells[c] ?? 0), 0)]),
  );

  return {
    rowDimension: query.rows || 'university',
    colDimension: query.cols || 'year',
    rowLabel: DIMENSION_LABELS[query.rows || 'university'],
    colLabel: DIMENSION_LABELS[query.cols || 'year'],
    columns,
    rows,
    columnTotals,
    grandTotal: rows.reduce((sum, r) => sum + r.total, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Needs attention                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Data-quality and follow-up queue. Stored status and dates drift apart as soon
 * as nobody updates a record, so surface the disagreements rather than quietly
 * counting a finished intern as active.
 */
export function getAttention(query = {}) {
  const today = query.as_of || iso(new Date());
  const { clause, params } = buildFilters({});
  const soon = new Date(Date.parse(today) + 14 * 86400000).toISOString().slice(0, 10);

  const pick = `i.id, i.intern_code, i.full_name, i.joining_date, i.end_date, i.status, i.photo_path,
                dep.name AS department_name, u.short_name AS university_short`;
  const from = `FROM interns i
                LEFT JOIN departments dep ON dep.id = i.department_id
                LEFT JOIN universities u ON u.id = i.university_id`;

  return {
    endingSoon: all(
      `SELECT ${pick} ${from}
        WHERE ${clause} AND i.status IN ('Active', 'Extended')
          AND i.end_date IS NOT NULL AND i.end_date BETWEEN ? AND ?
        ORDER BY i.end_date ASC LIMIT 20`,
      [...params, today, soon],
    ),
    overdue: all(
      `SELECT ${pick} ${from}
        WHERE ${clause} AND i.status IN ('Active', 'Extended')
          AND i.end_date IS NOT NULL AND i.end_date < ?
        ORDER BY i.end_date ASC LIMIT 20`,
      [...params, today],
    ),
    certificatePending: all(
      `SELECT ${pick} ${from}
        WHERE ${clause} AND i.status = 'Completed' AND i.certificate_issued = 0
        ORDER BY i.end_date DESC LIMIT 20`,
      params,
    ),
    startingSoon: all(
      `SELECT ${pick} ${from}
        WHERE ${clause} AND i.status = 'Upcoming' AND i.joining_date BETWEEN ? AND ?
        ORDER BY i.joining_date ASC LIMIT 20`,
      [...params, today, soon],
    ),
  };
}

/** Sparkline data for the KPI cards: joinings per month over the last 12 months. */
export function getSparkline(query = {}) {
  const { clause, params } = buildFilters(query);
  const rows = all(
    `SELECT strftime('%Y-%m', i.joining_date) AS bucket, COUNT(*) AS total
       FROM interns i
      WHERE ${clause} AND i.joining_date >= date(?, '-11 months', 'start of month')
      GROUP BY bucket ORDER BY bucket`,
    [...params, query.as_of || iso(new Date())],
  );
  return rows;
}
