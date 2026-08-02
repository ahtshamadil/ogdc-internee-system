import express from 'express';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { lookupSchema } from '../utils/validate.js';

const router = express.Router();

/**
 * Lookup tables are what make the dashboard's group-by comparisons meaningful,
 * so their editable columns are declared here rather than derived from input.
 */
const TABLES = {
  universities: { columns: ['name', 'short_name', 'city', 'is_active'], order: 'name' },
  degrees: { columns: ['name', 'level', 'is_active'], order: 'name' },
  departments: { columns: ['name', 'code', 'is_active'], order: 'name' },
  cities: { columns: ['name', 'province', 'is_active'], order: 'name' },
  supervisors: {
    columns: ['name', 'designation', 'department_id', 'email', 'phone', 'is_active'],
    order: 'name',
  },
};

function table(name) {
  const spec = TABLES[name];
  if (!spec) throw httpError(404, `Unknown lookup: ${name}`);
  return spec;
}

router.use(requireAuth);

/** Everything the forms and filter bar need, in one request. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      universities: all('SELECT * FROM universities WHERE is_active = 1 ORDER BY name'),
      degrees: all('SELECT * FROM degrees WHERE is_active = 1 ORDER BY level, name'),
      departments: all('SELECT * FROM departments WHERE is_active = 1 ORDER BY name'),
      cities: all('SELECT * FROM cities WHERE is_active = 1 ORDER BY name'),
      supervisors: all(
        `SELECT s.*, d.name AS department_name FROM supervisors s
           LEFT JOIN departments d ON d.id = s.department_id
          WHERE s.is_active = 1 ORDER BY s.name`,
      ),
    });
  }),
);

/** Admin view: includes deactivated entries and usage counts. */
router.get(
  '/:name/all',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    table(name);

    const usageColumn = {
      universities: 'university_id',
      degrees: 'degree_id',
      departments: 'department_id',
      cities: 'city_id',
      supervisors: 'supervisor_id',
    }[name];

    res.json({
      rows: all(
        `SELECT t.*, (SELECT COUNT(*) FROM interns i
                       WHERE i.${usageColumn} = t.id AND i.deleted_at IS NULL) AS usage_count
           FROM ${name} t ORDER BY t.name`,
      ),
    });
  }),
);

router.post(
  '/:name',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const spec = table(name);
    const data = lookupSchema.partial().parse(req.body);

    if (!data.name?.trim()) throw httpError(400, 'Name is required');

    const columns = spec.columns.filter((c) => data[c] !== undefined);
    const result = run(
      `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((c) => data[c] ?? null),
    );

    audit(req, {
      action: 'create',
      entity: `lookup:${name}`,
      entityId: Number(result.lastInsertRowid),
      details: { name: data.name },
    });
    res.status(201).json({ row: get(`SELECT * FROM ${name} WHERE id = ?`, [result.lastInsertRowid]) });
  }),
);

router.put(
  '/:name/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, id } = req.params;
    const spec = table(name);
    const data = lookupSchema.partial().parse(req.body);

    const columns = spec.columns.filter((c) => data[c] !== undefined);
    if (!columns.length) throw httpError(400, 'Nothing to update');

    run(
      `UPDATE ${name} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => data[c] ?? null), Number(id)],
    );

    audit(req, { action: 'update', entity: `lookup:${name}`, entityId: Number(id), details: data });
    res.json({ row: get(`SELECT * FROM ${name} WHERE id = ?`, [Number(id)]) });
  }),
);

/**
 * Deactivate rather than delete when a lookup is in use -- deleting would null
 * out the reference on existing interns and silently rewrite history.
 */
router.delete(
  '/:name/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, id } = req.params;
    table(name);

    const usageColumn = {
      universities: 'university_id',
      degrees: 'degree_id',
      departments: 'department_id',
      cities: 'city_id',
      supervisors: 'supervisor_id',
    }[name];

    const { n } = get(
      `SELECT COUNT(*) AS n FROM interns WHERE ${usageColumn} = ? AND deleted_at IS NULL`,
      [Number(id)],
    );

    if (n > 0) {
      run(`UPDATE ${name} SET is_active = 0 WHERE id = ?`, [Number(id)]);
      audit(req, { action: 'deactivate', entity: `lookup:${name}`, entityId: Number(id) });
      return res.json({ ok: true, deactivated: true, usage_count: n });
    }

    run(`DELETE FROM ${name} WHERE id = ?`, [Number(id)]);
    audit(req, { action: 'delete', entity: `lookup:${name}`, entityId: Number(id) });
    res.json({ ok: true, deactivated: false });
  }),
);

export default router;
