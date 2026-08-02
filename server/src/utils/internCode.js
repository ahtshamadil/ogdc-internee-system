import { get, run } from '../db/index.js';

/**
 * OGDC-INT-<year>-<seq>. Must be called inside an open transaction so the
 * counter bump and the intern INSERT commit together -- otherwise two
 * simultaneous submissions on the LAN could claim the same code.
 */
export function nextInternCode(joiningDate) {
  const year = Number(String(joiningDate).slice(0, 4)) || new Date().getFullYear();

  run('INSERT INTO code_counters (year, seq) VALUES (?, 0) ON CONFLICT(year) DO NOTHING', [year]);
  run('UPDATE code_counters SET seq = seq + 1 WHERE year = ?', [year]);
  const { seq } = get('SELECT seq FROM code_counters WHERE year = ?', [year]);

  return `OGDC-INT-${year}-${String(seq).padStart(3, '0')}`;
}
