/**
 * Internee Master Register.
 *
 * The document the ad-hoc screen table was standing in for: every internee in
 * the selected population, grouped, subtotalled and paginated.
 *
 * Built as one continuous table rather than one table per group, so pdfmake's
 * `headerRows` repeats the column headings on every page including mid-group.
 * Group headings and subtotals ride inside that table as full-width rows.
 */

import {
  COLOR, STATUS_COLOR, EMPTY, fmtDate, fmtNumber, text,
  titleBlock, parameterBlock, noRecords, th,
} from '../theme.js';
import { masterRegisterData, groupLabel } from '../../services/reportDataService.js';

const COLUMNS = [
  { key: 'seq', label: '#', width: 18, align: 'right' },
  { key: 'intern_code', label: 'Intern Code', width: 64 },
  { key: 'full_name', label: 'Name', width: '*' },
  { key: 'father_name', label: "Father's Name", width: '*' },
  { key: 'university_name', label: 'University', width: '*' },
  { key: 'degree_name', label: 'Degree', width: '*' },
  { key: 'joining_date', label: 'Joined', width: 50, align: 'center' },
  { key: 'end_date', label: 'Ended', width: 50, align: 'center' },
  { key: 'duration_weeks', label: 'Wks', width: 20, align: 'right' },
  { key: 'status', label: 'Status', width: 42 },
  { key: 'certificate_issued', label: 'Cert.', width: 22, align: 'center' },
];

const COLUMN_COUNT = COLUMNS.length;

function detailRow(row, seq) {
  return [
    { text: String(seq), alignment: 'right', color: COLOR.muted },
    { text: text(row.intern_code), fontSize: 6.8 },
    { text: text(row.full_name), bold: true },
    { text: text(row.father_name) },
    { text: text(row.university_short || row.university_name) },
    { text: text(row.degree_name) },
    { text: fmtDate(row.joining_date), alignment: 'center', fontSize: 6.8 },
    { text: row.end_date ? fmtDate(row.end_date) : EMPTY, alignment: 'center', fontSize: 6.8 },
    { text: row.duration_weeks ?? EMPTY, alignment: 'right' },
    { text: text(row.status), color: STATUS_COLOR[row.status] ?? COLOR.ink, bold: true, fontSize: 6.8 },
    {
      text: row.certificate_issued ? 'Yes' : EMPTY,
      alignment: 'center',
      color: row.certificate_issued ? COLOR.active : COLOR.muted,
      fontSize: 6.8,
    },
  ];
}

/** Full-width band that opens a group. */
function groupHeaderRow(group, dimensionLabel) {
  return [
    {
      colSpan: COLUMN_COUNT,
      fillColor: COLOR.band,
      margin: [4, 4, 4, 4],
      text: [
        { text: `${dimensionLabel}: `, fontSize: 7, color: COLOR.muted },
        { text: group.label, fontSize: 8.5, bold: true, color: COLOR.deep },
        {
          text: `    ${fmtNumber(group.total)} internee${group.total === 1 ? '' : 's'}`,
          fontSize: 7.5,
          color: COLOR.secondary,
        },
      ],
    },
    ...Array.from({ length: COLUMN_COUNT - 1 }, () => ({})),
  ];
}

/** Full-width band that closes a group with its counts. */
function groupFooterRow(group) {
  return [
    {
      colSpan: COLUMN_COUNT,
      margin: [4, 3, 4, 3],
      alignment: 'right',
      text: [
        { text: `Subtotal - ${group.label}:  `, fontSize: 7, color: COLOR.muted },
        { text: `${fmtNumber(group.total)} total`, fontSize: 7.5, bold: true, color: COLOR.ink },
        { text: `   ·   ${fmtNumber(group.active)} in progress`, fontSize: 7.5, color: COLOR.active },
        { text: `   ·   ${fmtNumber(group.completed)} completed`, fontSize: 7.5, color: COLOR.completed },
        { text: `   ·   ${fmtNumber(group.certificates)} certificates issued`, fontSize: 7.5, color: COLOR.secondary },
      ],
    },
    ...Array.from({ length: COLUMN_COUNT - 1 }, () => ({})),
  ];
}

function grandTotalRow(grand) {
  return [
    {
      colSpan: COLUMN_COUNT,
      fillColor: COLOR.band,
      margin: [4, 6, 4, 6],
      alignment: 'right',
      text: [
        { text: 'GRAND TOTAL:  ', fontSize: 8, bold: true, color: COLOR.ink, characterSpacing: 0.4 },
        { text: `${fmtNumber(grand.total)} internees`, fontSize: 9, bold: true, color: COLOR.ink },
        { text: `   ·   ${fmtNumber(grand.active)} in progress`, fontSize: 8, color: COLOR.active },
        { text: `   ·   ${fmtNumber(grand.completed)} completed`, fontSize: 8, color: COLOR.completed },
        { text: `   ·   ${fmtNumber(grand.certificates)} certificates issued`, fontSize: 8, color: COLOR.secondary },
      ],
    },
    ...Array.from({ length: COLUMN_COUNT - 1 }, () => ({})),
  ];
}

export default {
  id: 'master-register',
  title: 'Internee Master Register',
  code: 'OGDC/HR/INT-01',
  category: 'Register',
  scope: 'collection',
  orientation: 'landscape',
  description:
    'Every internee in the selected population, grouped with subtotals and a grand total. The primary register for HR records and audit.',
  parameters: [
    {
      key: 'group_by',
      label: 'Group by',
      type: 'select',
      default: 'department',
      options: ['department', 'university', 'degree', 'city', 'province', 'status', 'year', 'supervisor', 'none'],
    },
  ],

  data: (query) => masterRegisterData(query),

  content(data) {
    const heading = {
      ...titleBlock({
        title: 'Internee Master Register',
        // The label is used as written -- lower-casing it turns "OGDC Department"
        // into "ogdc department".
        subtitle:
          data.dimension === 'none'
            ? `${fmtNumber(data.grand.total)} internee record(s), listed in joining order`
            : `${fmtNumber(data.grand.total)} internee record(s), grouped by ${groupLabel(data.dimension)}`,
      }),
    };

    if (!data.grand.total) {
      return [heading, parameterBlock(data.parameters), noRecords()];
    }

    const body = [COLUMNS.map((c) => th(c.label, { align: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left' }))];

    let seq = 0;
    for (const group of data.groups) {
      if (group.label !== null) body.push(groupHeaderRow(group, data.dimensionLabel));
      for (const row of group.rows) {
        seq += 1;
        body.push(detailRow(row, seq));
      }
      if (group.label !== null) body.push(groupFooterRow(group));
    }
    body.push(grandTotalRow(data.grand));

    return [
      heading,
      parameterBlock(data.parameters),
      {
        table: {
          headerRows: 1,
          widths: COLUMNS.map((c) => c.width),
          body,
          // Marks the closing row so the layout can tint it.
          totalsRow: true,
        },
        layout: 'register',
        fontSize: 7.2,
      },
    ];
  },
};
