/**
 * Certificate Pending Register.
 *
 * A work queue, not an analysis: internees who finished their internship and
 * have no certificate recorded, oldest first, so the backlog is worked from the
 * end that has been waiting longest.
 */

import {
  COLOR, EMPTY, fmtDate, fmtNumber, text,
  titleBlock, parameterBlock, noRecords, sectionHeading, th,
} from '../theme.js';
import { certificatePendingData } from '../../services/reportDataService.js';

/** Anything past this many days since the end date is called out as overdue. */
const OVERDUE_DAYS = 30;

function summaryBar(data) {
  const box = (value, label, color) => ({
    width: '*',
    stack: [
      { text: fmtNumber(value), fontSize: 17, bold: true, color },
      { text: label, fontSize: 7, color: COLOR.muted, margin: [0, 1, 0, 0] },
    ],
  });

  return {
    margin: [0, 0, 0, 12],
    table: {
      widths: ['*'],
      body: [
        [
          {
            border: [false, false, false, false],
            fillColor: COLOR.bandAlt,
            margin: [12, 9, 12, 9],
            columns: [
              box(data.total, 'Certificates pending', COLOR.ink),
              box(data.overdue, `Waiting more than ${OVERDUE_DAYS} days`, data.overdue ? COLOR.terminated : COLOR.muted),
              box(data.groups.length, 'Departments affected', COLOR.ink),
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
}

function registerTable(rows) {
  const header = [
    th('#', { align: 'right' }),
    th('Intern Code'),
    th('Name'),
    th('University'),
    th('Supervisor'),
    th('Ended'),
    th('Waiting', { align: 'right' }),
    th('Rating', { align: 'right' }),
  ];

  const body = rows.map((row, i) => {
    const days = row.days_since_end ?? 0;
    const overdue = days > OVERDUE_DAYS;
    return [
      { text: String(i + 1), alignment: 'right', color: COLOR.muted },
      { text: text(row.intern_code), fontSize: 7 },
      { text: text(row.full_name), bold: true },
      { text: text(row.university_name) },
      { text: text(row.supervisor_name) },
      { text: fmtDate(row.end_date), alignment: 'center', fontSize: 7 },
      {
        text: days > 0 ? `${fmtNumber(days)} d` : EMPTY,
        alignment: 'right',
        bold: overdue,
        color: overdue ? COLOR.terminated : COLOR.secondary,
      },
      {
        text: row.evaluation_rating ? `${row.evaluation_rating}/5` : EMPTY,
        alignment: 'right',
        color: row.evaluation_rating ? COLOR.ink : COLOR.muted,
      },
    ];
  });

  return {
    table: { headerRows: 1, widths: [16, 62, '*', '*', '*', 50, 40, 30], body: [header, ...body] },
    layout: 'register',
    fontSize: 7.4,
  };
}

export default {
  id: 'certificate-pending',
  title: 'Certificate Pending Register',
  code: 'OGDC/HR/INT-05',
  category: 'Exception report',
  scope: 'collection',
  orientation: 'portrait',
  description:
    'Internees who have completed their internship but have no completion certificate recorded, grouped by department and ordered by how long they have been waiting.',
  parameters: [],

  data: (query) => certificatePendingData(query),

  content(data) {
    const heading = titleBlock({
      title: 'Certificate Pending Register',
      subtitle: 'Completed internships with no certificate recorded',
    });

    if (!data.total) {
      return [
        heading,
        parameterBlock(data.parameters),
        noRecords('No certificates are pending. Every completed internship has a certificate recorded.'),
      ];
    }

    const sections = data.groups.flatMap((group) => [
      sectionHeading(`${group.label}  ·  ${fmtNumber(group.total)} pending`),
      registerTable(group.rows),
    ]);

    return [
      heading,
      parameterBlock(data.parameters),
      summaryBar(data),
      {
        text: `Action required: issue the completion certificate for each internee below and record its number and date against the record. Entries marked in red have been waiting more than ${OVERDUE_DAYS} days.`,
        fontSize: 8,
        color: COLOR.secondary,
        margin: [0, 0, 0, 4],
      },
      ...sections,
    ];
  },
};
