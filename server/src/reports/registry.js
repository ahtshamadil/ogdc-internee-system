/**
 * The report catalogue.
 *
 * Every official report is registered here once and reached by id. Adding a
 * report means writing one definition file and adding it to this list -- the
 * route, the client catalogue and the audit trail all pick it up without
 * further wiring.
 *
 * A definition is deliberately just data plus two pure functions:
 *
 *   data(query)      -> a plain, already-grouped, already-totalled dataset
 *   content(data)    -> pdfmake content nodes
 *
 * Keeping those separate is what makes the catalogue portable: `data()` is the
 * engine-independent half and would be handed unchanged to a Crystal Reports
 * service if the rendering engine ever changes.
 */

import masterRegister from './definitions/masterRegister.js';
import profileSheet from './definitions/profileSheet.js';
import completionCertificate from './definitions/completionCertificate.js';
import departmentalSummary from './definitions/departmentalSummary.js';
import certificatePending from './definitions/certificatePending.js';
import dataQuality from './definitions/dataQuality.js';
import { renderPdf, runContext } from './render.js';

const DEFINITIONS = [
  masterRegister,
  departmentalSummary,
  certificatePending,
  dataQuality,
  profileSheet,
  completionCertificate,
];

const BY_ID = new Map(DEFINITIONS.map((d) => [d.id, d]));

export function getReport(id) {
  return BY_ID.get(String(id)) ?? null;
}

/** The catalogue as the client needs it -- descriptions, not implementations. */
export function listReports() {
  return DEFINITIONS.map(({ id, title, code, category, description, scope, orientation, parameters }) => ({
    id,
    title,
    code,
    category,
    description,
    scope,
    orientation,
    parameters: parameters ?? [],
  }));
}

/** `OGDC-Internee-Master-Register-2026-08-13.pdf` */
export function reportFilename(definition, data) {
  const title = (definition.titleFor?.(data) ?? definition.title)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `OGDC-${title}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/**
 * Builds one report end to end.
 *
 * @returns {Promise<{ buffer: Buffer, filename: string, rows: number }>}
 *          `rows` is written to the audit trail so an export of 240 records is
 *          distinguishable from an export of one.
 */
export async function renderReport(definition, query, req) {
  const data = definition.data(query);
  const ctx = runContext(req);

  const meta = {
    title: definition.titleFor?.(data) ?? definition.title,
    code: definition.code,
    subtitle: definition.subtitle,
    orientation: definition.orientation,
    plain: definition.plain === true,
    footnote: definition.footnoteFor?.(data),
  };

  const buffer = await renderPdf(meta, ctx, definition.content(data, ctx));

  return { buffer, filename: reportFilename(definition, data), rows: countRows(data) };
}

/** Best-effort record count for the audit entry, across the dataset shapes. */
function countRows(data) {
  if (!data) return 0;
  if (typeof data.total === 'number') return data.total;
  if (typeof data.grandTotal === 'number') return data.grandTotal;
  if (data.grand?.total !== undefined) return data.grand.total;
  // The exception report's population is the number of records it examined.
  if (typeof data.population === 'number') return data.population;
  if (data.intern) return 1;
  if (Array.isArray(data.rows)) return data.rows.length;
  return 0;
}
