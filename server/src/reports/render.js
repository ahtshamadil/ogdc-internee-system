/**
 * pdfmake wiring, kept in one place.
 *
 * The engine is deliberately behind this seam. Report definitions return a
 * document description and never import pdfmake themselves, so replacing the
 * renderer -- including handing these same datasets to a Crystal Reports
 * service later -- touches this file and nothing else.
 */

import { createRequire } from 'node:module';
import pdfMake from 'pdfmake';
import { buildDocument, fmtDateTime } from './theme.js';

const require = createRequire(import.meta.url);
const helvetica = require('pdfmake/standard-fonts/Helvetica.js');

/**
 * Helvetica is one of the fourteen fonts every PDF reader implements, so
 * nothing has to be embedded and no font file ships with the application.
 * pdfmake routes these names through the local-access policy, so they are
 * allow-listed by name and everything else on disk stays refused.
 */
const STANDARD_FONTS = new Set([
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
]);

pdfMake.addFonts(helvetica);
// A report is built from data this process already holds; it must never fetch a
// URL or read an arbitrary file just because a value in the database said so.
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((path) => STANDARD_FONTS.has(path));

/**
 * @param {object} meta     { title, code, subtitle, orientation }
 * @param {object} ctx      { runBy, generatedAt }
 * @param {Array}  content  pdfmake content nodes
 * @returns {Promise<Buffer>}
 */
export async function renderPdf(meta, ctx, content) {
  const doc = pdfMake.createPdf(buildDocument(meta, ctx, content));
  return doc.getBuffer();
}

/** Run context stamped into every footer. */
export function runContext(req) {
  return {
    runBy: req?.user?.username ?? 'unknown',
    runByName: req?.user?.full_name ?? 'Unknown user',
    generatedAt: fmtDateTime(new Date().toISOString()),
  };
}
