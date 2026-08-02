import express from 'express';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { userSchema } from '../utils/validate.js';
import { hashPassword, generatePassword } from '../utils/password.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      rows: all(
        `SELECT id, username, full_name, role, is_active, must_change_password, last_login_at, created_at
           FROM users ORDER BY role, username`,
      ),
    });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = userSchema.parse(req.body);

    if (get('SELECT id FROM users WHERE username = ?', [data.username])) {
      throw httpError(409, 'That username is already taken');
    }

    // Generated when left blank, and shown once so the admin can hand it over.
    const password = data.password || generatePassword(12);
    const result = run(
      `INSERT INTO users (username, password_hash, full_name, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [data.username, hashPassword(password), data.full_name, data.role, data.is_active],
    );

    audit(req, {
      action: 'create',
      entity: 'user',
      entityId: Number(result.lastInsertRowid),
      details: { username: data.username, role: data.role },
    });

    res.status(201).json({
      user: get('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?', [
        result.lastInsertRowid,
      ]),
      generated_password: data.password ? null : password,
    });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw httpError(404, 'User not found');

    const data = userSchema.omit({ password: true }).parse(req.body);

    // Locking yourself out of the only admin account leaves nobody able to fix it.
    if (id === req.user.id && (data.role !== 'admin' || !data.is_active)) {
      throw httpError(400, 'You cannot remove your own administrator access');
    }
    if (user.role === 'admin' && data.role !== 'admin') {
      const { n } = get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1");
      if (n <= 1) throw httpError(400, 'There must be at least one active administrator');
    }

    run('UPDATE users SET username = ?, full_name = ?, role = ?, is_active = ? WHERE id = ?', [
      data.username,
      data.full_name,
      data.role,
      data.is_active,
      id,
    ]);

    audit(req, { action: 'update', entity: 'user', entityId: id, details: data });
    res.json({
      user: get('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?', [id]),
    });
  }),
);

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw httpError(404, 'User not found');

    const password = generatePassword(12);
    run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [
      hashPassword(password),
      id,
    ]);

    audit(req, { action: 'reset_password', entity: 'user', entityId: id, details: { username: user.username } });
    res.json({ ok: true, password });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw httpError(400, 'You cannot delete your own account');

    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw httpError(404, 'User not found');

    if (user.role === 'admin') {
      const { n } = get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1");
      if (n <= 1) throw httpError(400, 'There must be at least one active administrator');
    }

    // Deactivate, never hard-delete: the audit log references this row and an
    // orphaned trail is worse than a disabled account.
    run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    audit(req, { action: 'deactivate', entity: 'user', entityId: id, details: { username: user.username } });
    res.json({ ok: true });
  }),
);

router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    res.json({
      rows: all(
        `SELECT id, username, action, entity, entity_id, details_json, at
           FROM audit_log ORDER BY at DESC, id DESC LIMIT ?`,
        [limit],
      ),
    });
  }),
);

export default router;
