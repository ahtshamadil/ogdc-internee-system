import express from 'express';
import Papa from 'papaparse';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { listAllInterns } from '../services/internService.js';
import { getBreakdown, getMatrix } from '../services/analyticsService.js';
import { analyseCsv, commitImport, importTemplateCsv, IMPORT_COLUMNS } from '../services/importService.js';
import { listReports, getReport, renderReport } from '../reports/registry.js';

const router = express.Router();

router.use(requireAuth);

/** Columns offered in the report builder, in the order they export. */
const EXPORT_COLUMNS = [
  ['intern_code', 'Intern Code'],
  ['full_name', 'Full Name'],
  ['father_name', "Father's Name"],
  ['cnic', 'CNIC'],
  ['gender', 'Gender'],
  ['dob', 'Date of Birth'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['city_name', 'City'],
  ['city_province', 'Province'],
  ['address', 'Address'],
  ['university_name', 'University'],
  ['degree_name', 'Degree'],
  ['degree_level', 'Level'],
  ['major', 'Major'],
  ['semester', 'Semester'],
  ['cgpa', 'CGPA'],
  ['enrollment_no', 'Enrollment No'],
  ['department_name', 'Department'],
  ['supervisor_name', 'Supervisor'],
  ['joining_date', 'Joining Date'],
  ['end_date', 'End Date'],
  ['duration_weeks', 'Duration (weeks)'],
  ['status', 'Status'],
  ['certificate_issued', 'Certificate Issued'],
  ['certificate_date', 'Certificate Date'],
  ['certificate_no', 'Certificate No'],
  ['evaluation_rating', 'Evaluation Rating'],
  ['evaluation_remarks', 'Evaluation Remarks'],
  ['referred_by', 'Referred By'],
  ['emergency_contact_name', 'Emergency Contact'],
  ['emergency_contact_phone', 'Emergency Phone'],
  ['document_count', 'Documents'],
  ['created_by_name', 'Entered By'],
  ['created_at', 'Entered On'],
];

router.get(
  '/columns',
  asyncHandler(async (_req, res) => {
    res.json({ columns: EXPORT_COLUMNS.map(([key, label]) => ({ key, label })) });
  }),
);

/** JSON for the on-screen report table; the client renders and prints it. */
router.get(
  '/interns',
  asyncHandler(async (req, res) => {
    res.json({ rows: listAllInterns(req.query) });
  }),
);

function toCsv(rows, columnKeys) {
  const columns = EXPORT_COLUMNS.filter(([key]) => columnKeys.includes(key));
  const data = rows.map((row) =>
    Object.fromEntries(
      columns.map(([key, label]) => {
        let value = row[key];
        if (key === 'certificate_issued') value = value ? 'Yes' : 'No';
        return [label, value ?? ''];
      }),
    ),
  );
  // Excel on a Windows machine needs the BOM to read UTF-8 names correctly.
  return `﻿${Papa.unparse(data, { columns: columns.map(([, label]) => label) })}`;
}

router.get(
  '/interns.csv',
  asyncHandler(async (req, res) => {
    const requested = String(req.query.columns || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const columnKeys = requested.length ? requested : EXPORT_COLUMNS.map(([key]) => key);

    const rows = listAllInterns(req.query);
    const stamp = new Date().toISOString().slice(0, 10);

    audit(req, { action: 'export', entity: 'report', details: { rows: rows.length, format: 'csv' } });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="OGDC-Internees-${stamp}.csv"`);
    res.send(toCsv(rows, columnKeys));
  }),
);

/** CSV of any breakdown, for pasting into a slide deck. */
router.get(
  '/breakdown.csv',
  asyncHandler(async (req, res) => {
    const breakdown = getBreakdown(req.query);
    const data = breakdown.rows.map((r) => ({
      [breakdown.label]: r.label,
      Total: r.total,
      Active: r.active,
      Completed: r.completed,
      'Share %': r.pct.toFixed(1),
    }));

    audit(req, {
      action: 'export',
      entity: 'report',
      details: { rows: data.length, format: 'csv', breakdown: breakdown.dimension },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="OGDC-${breakdown.dimension}-breakdown.csv"`,
    );
    res.send(`﻿${Papa.unparse(data)}`);
  }),
);

router.get(
  '/matrix.csv',
  asyncHandler(async (req, res) => {
    const matrix = getMatrix(req.query);
    const data = matrix.rows.map((row) => ({
      [matrix.rowLabel]: row.label,
      ...Object.fromEntries(matrix.columns.map((c) => [c, row.cells[c] ?? 0])),
      Total: row.total,
    }));
    data.push({
      [matrix.rowLabel]: 'TOTAL',
      ...matrix.columnTotals,
      Total: matrix.grandTotal,
    });

    audit(req, {
      action: 'export',
      entity: 'report',
      details: { rows: matrix.rows.length, format: 'csv', crosstab: `${matrix.rowDimension} x ${matrix.colDimension}` },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="OGDC-crosstab.csv"`);
    res.send(`﻿${Papa.unparse(data)}`);
  }),
);

/* -------------------------- Official PDF reports ------------------------- */

/**
 * Per-record documents are issued rather than browsed -- a completion
 * certificate is an official instrument and a profile sheet carries the
 * internee's full CNIC and address on one page. Those are restricted to the
 * roles that maintain the records; the collection reports stay available to
 * everyone who can already see the internee list.
 */
const RECORD_DOCUMENT_ROLES = ['admin', 'hr'];

function resolveReport(req) {
  const definition = getReport(req.params.id);
  if (!definition) throw httpError(404, `Unknown report: ${req.params.id}`);
  if (definition.scope === 'record' && !RECORD_DOCUMENT_ROLES.includes(req.user.role)) {
    throw httpError(403, 'You do not have permission to produce this document');
  }
  return definition;
}

router.get(
  '/catalogue',
  asyncHandler(async (req, res) => {
    const reports = listReports().filter(
      (r) => r.scope !== 'record' || RECORD_DOCUMENT_ROLES.includes(req.user.role),
    );
    res.json({ reports });
  }),
);

/**
 * The shaped dataset behind a report, before rendering.
 *
 * Exposed deliberately: it is the engine-independent half of the catalogue, so
 * it is what any other reporting engine would consume, and it makes a report's
 * figures checkable without reading a PDF.
 */
router.get(
  '/data/:id',
  asyncHandler(async (req, res) => {
    const definition = resolveReport(req);
    res.json({ report: definition.id, title: definition.title, data: definition.data(req.query) });
  }),
);

router.get(
  '/pdf/:id',
  asyncHandler(async (req, res) => {
    const definition = resolveReport(req);
    const { buffer, filename, rows } = await renderReport(definition, req.query, req);

    audit(req, {
      action: 'export',
      entity: 'report',
      details: { report: definition.id, code: definition.code, format: 'pdf', rows },
    });

    res.setHeader('Content-Type', 'application/pdf');
    // `inline` so the browser can preview it; the client adds a download
    // attribute when the user asks for the file rather than a look at it.
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }),
);

/* ----------------------------- CSV import ------------------------------- */

router.get(
  '/import/template.csv',
  requireRole('admin', 'hr'),
  asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="OGDC-Internee-Import-Template.csv"');
    res.send(`﻿${importTemplateCsv()}`);
  }),
);

router.get(
  '/import/columns',
  requireRole('admin', 'hr'),
  asyncHandler(async (_req, res) => {
    res.json({ columns: IMPORT_COLUMNS });
  }),
);

/** Dry run: validates and reports, writes nothing. */
router.post(
  '/import/analyse',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || !csv.trim()) throw httpError(400, 'Paste or upload a CSV file first');
    res.json(analyseCsv(csv));
  }),
);

router.post(
  '/import/commit',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || !csv.trim()) throw httpError(400, 'Nothing to import');

    // Re-analysed server-side rather than trusting a client-supplied row list.
    const analysis = analyseCsv(csv);
    const result = commitImport(analysis.rows, req.user.id, {
      skipDuplicates: req.body?.skip_duplicates !== false,
    });

    audit(req, { action: 'import', entity: 'intern', details: { imported: result.imported, skipped: result.skipped } });
    res.json(result);
  }),
);

export default router;
