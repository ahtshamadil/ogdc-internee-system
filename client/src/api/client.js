/**
 * Thin fetch wrapper.
 *
 * Auth rides on an httpOnly cookie, so there is no token to attach here -- the
 * browser sends it. A 401 means the session expired; the AuthContext listens
 * for that and bounces to the login screen rather than leaving broken pages up.
 */

const listeners = new Set();
export const onUnauthorized = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export class ApiError extends Error {
  constructor(message, { status, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields ?? null;
  }
}

async function request(method, path, { body, signal, raw = false } = {}) {
  const isFormData = body instanceof FormData;

  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    signal,
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  // A 401 from the sign-in attempt itself is "wrong password", not "your
  // session expired" -- it must keep the server's own message, and must not
  // trip the session-expired listeners. /auth/me is the boot-time probe, where
  // a 401 simply means "nobody is signed in".
  const isLoginAttempt = path.startsWith('/auth/login');
  const isSessionProbe = path.startsWith('/auth/me');

  if (res.status === 401 && !isLoginAttempt) {
    if (!isSessionProbe) for (const fn of listeners) fn();
    throw new ApiError('Your session has ended. Please sign in again.', { status: 401 });
  }

  if (raw) {
    if (!res.ok) throw new ApiError('Request failed', { status: res.status });
    return res;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, {
      status: res.status,
      fields: data?.fields,
    });
  }

  return data;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
  raw: (path, options) => request('GET', path, { ...options, raw: true }),
};

/** Build a query string, dropping empty values so URLs stay readable. */
export function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' ) continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

/** Trigger a browser download for an authenticated endpoint. */
export async function downloadFile(path, fallbackName) {
  const res = await api.raw(path, { raw: true });
  const blob = await res.blob();

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
