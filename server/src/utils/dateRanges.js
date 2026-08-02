/**
 * Period maths for the dashboard's comparison cards.
 *
 * All dates are ISO 'YYYY-MM-DD' strings, matching how they are stored, and
 * all ranges are inclusive of both ends.
 */

export const iso = (d) => d.toISOString().slice(0, 10);

const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const parse = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return utc(y, m - 1, d);
};
const addDays = (date, n) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
};
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * @param {string} today   reference date, ISO
 * @param {boolean} likeForLike
 *   Month and year comparisons are misleading by default: on the 8th of the
 *   month, "this month" covers 8 days and "last month" covers 31, so the card
 *   always shows a collapse. With likeForLike the previous period is truncated
 *   to the same number of elapsed days, which is the comparison a reader
 *   actually means. The raw full-period figure stays available via the toggle.
 */
export function buildPeriods(today = iso(new Date()), likeForLike = true) {
  const ref = parse(today);
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const dayOfMonth = ref.getUTCDate();

  // --- rolling windows: always like-for-like by construction ---
  const rolling = (days) => ({
    current: { start: iso(addDays(ref, -(days - 1))), end: today },
    previous: { start: iso(addDays(ref, -(days * 2 - 1))), end: iso(addDays(ref, -days)) },
  });

  // --- calendar month ---
  const monthStart = utc(y, m, 1);
  const prevMonthYear = m === 0 ? y - 1 : y;
  const prevMonth = m === 0 ? 11 : m - 1;
  const prevMonthStart = utc(prevMonthYear, prevMonth, 1);
  const prevMonthLastDay = lastDayOfMonth(prevMonthYear, prevMonth);
  const month = {
    current: { start: iso(monthStart), end: today },
    previous: {
      start: iso(prevMonthStart),
      // Clamp: 31 Mar has no counterpart in February.
      end: iso(utc(prevMonthYear, prevMonth, likeForLike ? Math.min(dayOfMonth, prevMonthLastDay) : prevMonthLastDay)),
    },
  };

  // --- calendar year ---
  const dayOfYear = Math.floor((ref - utc(y, 0, 1)) / 86400000);
  const year = {
    current: { start: iso(utc(y, 0, 1)), end: today },
    previous: {
      start: iso(utc(y - 1, 0, 1)),
      end: likeForLike ? iso(addDays(utc(y - 1, 0, 1), dayOfYear)) : iso(utc(y - 1, 11, 31)),
    },
  };

  return {
    week: rolling(7),
    month,
    quarter: rolling(90),
    half: rolling(180),
    year,
  };
}

export const PERIOD_LABELS = {
  week: { title: 'This week', caption: 'vs previous 7 days' },
  month: { title: 'This month', caption: 'vs last month' },
  quarter: { title: 'Last 3 months', caption: 'vs preceding 3 months' },
  half: { title: 'Last 6 months', caption: 'vs preceding 6 months' },
  year: { title: 'This year', caption: 'vs last year' },
};

/** Percentage change, guarding the divide-by-zero that makes dashboards lie. */
export function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null; // null renders as "new"
  return ((current - previous) / previous) * 100;
}
