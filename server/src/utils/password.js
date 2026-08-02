import crypto from 'node:crypto';

/**
 * scrypt from node:crypto -- deliberately not bcrypt, which is a native module
 * and would need Visual Studio Build Tools on the machine this is installed on.
 * Parameters follow the OWASP scrypt recommendation (N=2^16, r=8, p=1).
 */
const N = 65536;
const r = 8;
const p = 1;
const KEYLEN = 64;
const MAXMEM = 160 * N * r; // scrypt needs ~128*N*r bytes; give it headroom.

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, n, rr, pp, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(rr),
      p: Number(pp),
      maxmem: 160 * Number(n) * Number(rr),
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Readable but strong -- this gets printed to a console once and typed in. */
export function generatePassword(length = 14) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(length))
    .map((b) => alphabet[b % alphabet.length])
    .join('');
}
