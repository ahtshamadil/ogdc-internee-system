/** Shared formatting so a number looks the same everywhere it appears. */

export const nf = new Intl.NumberFormat('en-US');

export const num = (value) => (value == null || Number.isNaN(value) ? '—' : nf.format(value));

export function pct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** Signed percentage for delta pills; null means "no previous period". */
export function signedPct(value, digits = 1) {
  if (value == null) return 'new';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date -> "12 Mar 2026". Parsed as UTC so it never shifts a day. */
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  // SQLite datetime('now') returns UTC without a zone marker.
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(date.toISOString())}, ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** "2026-03" / "2026-Q1" / "2026-W07" / "2026" -> a readable axis tick. */
export function formatBucket(bucket) {
  if (!bucket) return '';
  const str = String(bucket);
  if (/^\d{4}$/.test(str)) return str;
  if (/^\d{4}-Q[1-4]$/.test(str)) return str.replace('-', ' ');
  if (/^\d{4}-W\d{1,2}$/.test(str)) {
    const [year, week] = str.split('-W');
    return `W${week} '${year.slice(2)}`;
  }
  const [year, month] = str.split('-');
  if (month) return `${MONTHS[Number(month) - 1]} '${year.slice(2)}`;
  return str;
}

export function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Days from today; negative means in the past. */
export function daysFromToday(iso) {
  if (!iso) return null;
  const then = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${todayIso()}T00:00:00Z`);
  return Math.round((then - now) / 86400000);
}

export function relativeDays(iso) {
  const days = daysFromToday(iso);
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export const STATUS_CLASS = {
  Active: 'pill-active',
  Completed: 'pill-completed',
  Upcoming: 'pill-upcoming',
  Terminated: 'pill-terminated',
  Extended: 'pill-extended',
};
