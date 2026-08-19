/**
 * Departmental Intake Summary.
 *
 * Three views of the same population on one document: volume over time as a
 * cross-tab, relative size as a bar chart, and composition by status.
 *
 * The chart is drawn as a table row per department -- label, bar, value -- so
 * every bar carries its own number. That follows the rule the application's
 * chart palette was built around: no figure is ever conveyed by length or
 * colour alone, which also means the page survives a black-and-white photocopy.
 */

import {
  COLOR, fmtNumber, fmtPercent, titleBlock, parameterBlock, noRecords, sectionHeading, th,
} from '../theme.js';
import { departmentalSummaryData } from '../../services/reportDataService.js';

const CHART_WIDTH = 300;
const CHART_ROWS = 14;

function chart(rows, grandTotal) {
  const shown = rows.slice(0, CHART_ROWS);
  const max = Math.max(1, ...shown.map((r) => r.total));

  const body = shown.map((row) => {
    const width = Math.max(1.2, (row.total / max) * CHART_WIDTH);
    return [
      { text: row.label, fontSize: 7.4, margin: [0, 1.5, 0, 0] },
      {
        // y offset centres the bar against the label's cap height.
        canvas: [{ type: 'rect', x: 0, y: 1.5, w: width, h: 7.5, r: 1, color: COLOR.teal }],
      },
      { text: fmtNumber(row.total), fontSize: 7.4, bold: true, alignment: 'right', margin: [0, 1.5, 0, 0] },
      {
        text: fmtPercent(grandTotal ? (row.total / grandTotal) * 100 : 0),
        fontSize: 7.4,
        color: COLOR.muted,
        alignment: 'right',
        margin: [0, 1.5, 0, 0],
      },
    ];
  });

  return {
    table: { widths: ['*', CHART_WIDTH, 34, 34], body },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: (i) => (i === 0 ? 0 : 6),
      paddingRight: () => 0,
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
    },
  };
}

function matrix(data) {
  const header = [
    th('OGDC Department'),
    ...data.columns.map((c) => th(c, { align: 'right' })),
    th('Total', { align: 'right' }),
  ];

  const rows = data.rows.map((row) => [
    { text: row.label, bold: true },
    ...data.columns.map((c) => ({
      text: row.cells[c] ? fmtNumber(row.cells[c]) : '·',
      alignment: 'right',
      color: row.cells[c] ? COLOR.ink : COLOR.rule,
    })),
    { text: fmtNumber(row.total), alignment: 'right', bold: true },
  ]);

  const totals = [
    { text: 'TOTAL', bold: true, color: COLOR.ink },
    ...data.columns.map((c) => ({
      text: fmtNumber(data.columnTotals[c]),
      alignment: 'right',
      bold: true,
      color: COLOR.ink,
    })),
    { text: fmtNumber(data.grandTotal), alignment: 'right', bold: true, color: COLOR.ink },
  ];

  return {
    table: {
      headerRows: 1,
      widths: ['*', ...data.columns.map(() => 46), 50],
      body: [header, ...rows, totals],
      totalsRow: true,
    },
    layout: 'matrix',
    fontSize: 7.6,
  };
}

function statusTable(status) {
  const header = [
    th('OGDC Department'),
    th('Active', { align: 'right' }),
    th('Completed', { align: 'right' }),
    th('Upcoming', { align: 'right' }),
    th('Terminated', { align: 'right' }),
    th('Certificates', { align: 'right' }),
    th('Total', { align: 'right' }),
  ];

  const cell = (value, color) => ({
    text: value ? fmtNumber(value) : '·',
    alignment: 'right',
    color: value ? color : COLOR.rule,
  });

  const rows = status.map((r) => [
    { text: r.label, bold: true },
    cell(r.active, COLOR.active),
    cell(r.completed, COLOR.completed),
    cell(r.upcoming, COLOR.upcoming),
    cell(r.terminated, COLOR.terminated),
    cell(r.certificates, COLOR.secondary),
    { text: fmtNumber(r.total), alignment: 'right', bold: true },
  ]);

  const sum = (key) => status.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  const totals = [
    { text: 'TOTAL', bold: true },
    { text: fmtNumber(sum('active')), alignment: 'right', bold: true },
    { text: fmtNumber(sum('completed')), alignment: 'right', bold: true },
    { text: fmtNumber(sum('upcoming')), alignment: 'right', bold: true },
    { text: fmtNumber(sum('terminated')), alignment: 'right', bold: true },
    { text: fmtNumber(sum('certificates')), alignment: 'right', bold: true },
    { text: fmtNumber(sum('total')), alignment: 'right', bold: true },
  ];

  return {
    table: { headerRows: 1, widths: ['*', 52, 58, 54, 60, 62, 50], body: [header, ...rows, totals], totalsRow: true },
    layout: 'register',
    fontSize: 7.6,
  };
}

export default {
  id: 'departmental-summary',
  title: 'Departmental Intake Summary',
  code: 'OGDC/HR/INT-04',
  category: 'Management summary',
  scope: 'collection',
  orientation: 'landscape',
  description:
    'Internee intake by OGDC department and joining year, with a ranked distribution chart and a status composition table. The management view of where internees are placed.',
  parameters: [],

  data: (query) => departmentalSummaryData(query),

  content(data) {
    const heading = titleBlock({
      title: 'Departmental Intake Summary',
      subtitle: `${fmtNumber(data.grandTotal)} internee record(s) across ${fmtNumber(data.rows.length)} department(s)`,
    });

    if (!data.grandTotal) return [heading, parameterBlock(data.parameters), noRecords()];

    const truncated = data.rows.length > CHART_ROWS;

    return [
      heading,
      parameterBlock(data.parameters),

      sectionHeading('Intake by department and joining year', { top: 0 }),
      matrix(data),

      sectionHeading('Relative share of intake'),
      chart(data.rows, data.grandTotal),
      truncated
        ? {
            text: `Chart shows the ${CHART_ROWS} largest departments of ${fmtNumber(data.rows.length)}. The table above lists all of them.`,
            style: 'note',
            margin: [0, 6, 0, 0],
          }
        : {},

      { text: '', pageBreak: 'before' },
      sectionHeading('Status composition by department', { top: 0 }),
      statusTable(data.status),
    ];
  },
};
