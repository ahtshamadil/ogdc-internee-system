import { run } from '../db/index.js';

/**
 * Append-only record of who changed what. A shared LAN app with several people
 * entering data is unusable for HR disputes without it.
 */
export function audit(req, { action, entity, entityId = null, details = null }) {
  try {
    run(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req?.user?.id ?? null,
        req?.user?.username ?? null,
        action,
        entity,
        entityId,
        details ? JSON.stringify(details) : null,
      ],
    );
  } catch (err) {
    // Auditing must never take down the operation it is recording.
    console.error('[audit] failed to write entry:', err.message);
  }
}

/** Field-level diff, so the timeline can say what actually changed. */
export function diffFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (String(from ?? '') !== String(to ?? '')) changes[field] = { from, to };
  }
  return changes;
}
