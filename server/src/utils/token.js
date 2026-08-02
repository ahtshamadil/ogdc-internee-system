import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Minimal HS256 JWT. A whole library for sign + verify of our own tokens is
 * not worth another dependency on a machine that may install offline.
 */
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function signature(data) {
  return crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
}

export function signToken(payload, { hours = config.sessionHours } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + hours * 3600 };
  const data = `${b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64u(JSON.stringify(body))}`;
  return `${data}.${signature(data)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = signature(data);
  const given = parts[2];

  // Compare as fixed-length buffers so timingSafeEqual cannot throw on length.
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
