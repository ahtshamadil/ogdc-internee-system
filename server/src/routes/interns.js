import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit, diffFields } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { internSchema } from '../utils/validate.js';
import {
  listInterns,
  listAllInterns,
  getIntern,
  getInternRaw,
  createIntern,
  updateIntern,
  softDeleteIntern,
  restoreIntern,
  listDeletedInterns,
  getInternTimeline,
  WRITABLE_FIELDS,
} from '../services/internService.js';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(listInterns(req.query));
  }),
);

router.get(
  '/deleted',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    res.json({ rows: listDeletedInterns() });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const intern = getIntern(req.params.id);
    if (!intern) throw httpError(404, 'Intern not found');
    res.json({ intern });
  }),
);

router.get(
  '/:id/timeline',
  asyncHandler(async (req, res) => {
    res.json({ rows: getInternTimeline(req.params.id) });
  }),
);

router.post(
  '/',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const data = internSchema.parse(req.body);
    const intern = createIntern(data, req.user.id);
    audit(req, {
      action: 'create',
      entity: 'intern',
      entityId: intern.id,
      details: { intern_code: intern.intern_code, full_name: intern.full_name },
    });
    res.status(201).json({ intern });
  }),
);

router.put(
  '/:id',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const before = getInternRaw(req.params.id);
    if (!before) throw httpError(404, 'Intern not found');

    const data = internSchema.parse(req.body);
    const intern = updateIntern(req.params.id, data, req.user.id);

    const changes = diffFields(before, intern, WRITABLE_FIELDS);
    audit(req, {
      action: 'update',
      entity: 'intern',
      entityId: intern.id,
      details: { intern_code: intern.intern_code, changes },
    });

    res.json({ intern });
  }),
);

router.delete(
  '/:id',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const intern = getInternRaw(req.params.id);
    if (!intern) throw httpError(404, 'Intern not found');

    softDeleteIntern(req.params.id, req.user.id);
    audit(req, {
      action: 'delete',
      entity: 'intern',
      entityId: intern.id,
      details: { intern_code: intern.intern_code, full_name: intern.full_name },
    });

    res.json({ ok: true });
  }),
);

router.post(
  '/:id/restore',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    restoreIntern(req.params.id, req.user.id);
    audit(req, { action: 'restore', entity: 'intern', entityId: Number(req.params.id) });
    res.json({ ok: true, intern: getIntern(req.params.id) });
  }),
);

export default router;
export { listAllInterns };
