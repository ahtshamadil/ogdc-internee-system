import { get } from '../db/index.js';
import { verifyToken } from '../utils/token.js';

export const COOKIE_NAME = 'ogdc_session';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  // No `secure` flag: the LAN deployment is plain HTTP, and a secure cookie
  // would simply never be sent. Documented as a known limitation in README.
  path: '/',
};

/**
 * Populates req.user when a valid session cookie is present. Never rejects --
 * requireAuth does that, so public routes can stay public.
 */
export function attachUser(req, _res, next) {
  const payload = verifyToken(req.cookies?.[COOKIE_NAME]);
  if (payload?.sub) {
    const user = get(
      'SELECT id, username, full_name, role, is_active, must_change_password FROM users WHERE id = ?',
      [payload.sub],
    );
    // Deactivating a user takes effect on their next request, not just at login.
    if (user?.is_active) req.user = user;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

/**
 * Role gate. This is the real enforcement -- the client's <RoleGate> only hides
 * buttons, so every write route must be wrapped here too.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}
