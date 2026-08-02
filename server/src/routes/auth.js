import express from 'express';
import { get, run } from '../db/index.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { COOKIE_NAME, cookieOptions, requireAuth } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { loginSchema, changePasswordSchema } from '../utils/validate.js';
import { config } from '../config.js';

const router = express.Router();

/**
 * Login throttling, in memory and per username+IP.
 *
 * A LAN app is reachable by everyone in the building, so an unthrottled login
 * form is a free password-guessing oracle. In-memory is the right scope here:
 * one process, and a restart clearing the counters is acceptable.
 */
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;

function throttleKey(req, username) {
  return `${req.ip}|${String(username).toLowerCase()}`;
}

function checkThrottle(key) {
  const record = attempts.get(key);
  if (!record) return null;
  if (Date.now() > record.until) {
    attempts.delete(key);
    return null;
  }
  if (record.count >= MAX_ATTEMPTS) {
    return Math.ceil((record.until - Date.now()) / 60000);
  }
  return null;
}

function recordFailure(key) {
  const record = attempts.get(key) ?? { count: 0, until: Date.now() + LOCKOUT_MS };
  record.count += 1;
  record.until = Date.now() + LOCKOUT_MS;
  attempts.set(key, record);
}

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  full_name: user.full_name,
  role: user.role,
  must_change_password: !!user.must_change_password,
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const key = throttleKey(req, username);

    const lockedFor = checkThrottle(key);
    if (lockedFor) {
      throw httpError(429, `Too many failed attempts. Try again in ${lockedFor} minute(s).`);
    }

    const user = get('SELECT * FROM users WHERE username = ?', [username]);

    // Same message and same work either way, so the response cannot be used to
    // discover which usernames exist.
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordFailure(key);
      audit(req, { action: 'login_failed', entity: 'user', details: { username } });
      throw httpError(401, 'Incorrect username or password');
    }

    if (!user.is_active) throw httpError(403, 'This account has been deactivated');

    attempts.delete(key);
    run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    const token = signToken({ sub: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: config.sessionHours * 3600 * 1000 });

    req.user = user;
    audit(req, { action: 'login', entity: 'user', entityId: user.id });
    res.json({ user: publicUser(user) });
  }),
);

router.post('/logout', (req, res) => {
  if (req.user) audit(req, { action: 'logout', entity: 'user', entityId: req.user.id });
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: publicUser(req.user) });
});

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!verifyPassword(current_password, user.password_hash)) {
      throw httpError(400, 'Your current password is not correct');
    }

    run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [
      hashPassword(new_password),
      user.id,
    ]);
    audit(req, { action: 'change_password', entity: 'user', entityId: user.id });

    res.json({ ok: true, user: { ...publicUser(user), must_change_password: false } });
  }),
);

export default router;
