/**
 * Data Quality Exception Report.
 *
 * Stored status and stored dates drift apart the moment nobody updates a
 * record. This report surfaces the disagreements rather than letting a finished
 * internship keep counting as active in every other report.
 *
 * Each section states what is wrong and what to do about it -- an exception
 * report that only lists record codes gets filed and forgotten.
 */

import {
  COLOR, EMPTY, fmtDate, fmtNumber, fmtPercent, text,
  titleBlock, parameterBlock, noRecords, th,
} from '../theme.js';
import { dataQualityData } from '../../services/reportDataService.js';

function summaryBar(data) {
  const rate = data.population ? (data.affected / data.population) * 100 : 0;
  const clean = data.population - data.affected;

  const box = (value, label, color) => ({
    width: '*',
    stack: [
      { text: value, fontSize: 17, bold: true, color },
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
              box(fmtNumber(data.population), 'Records examined', COLOR.ink),
              box(fmtNumber(clean), 'Records with no exceptions', COLOR.active),
              box(fmtNumber(data.affected), 'Records needing attention', data.affected ? COLOR.terminated : COLOR.active),
              box(fmtPercent(rate), 'Of the population', COLOR.secondary),
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
}

/** Index of every check and its count, so the reader can triage before reading. */
function checkIndex(checks) {
  const header = [th('Check'), th('Records', { align: 'right' })];
  const body = checks.map((c) => [
    { text: c.title, color: c.rows.length ? COLOR.ink : COLOR.muted },
    {
      text: fmtNumber(c.rows.length),
      alignment: 'right',
      bold: c.rows.length > 0,
      color: c.rows.length ? COLOR.terminated : COLOR.active,
    },
  ]);

  return {
    table: { headerRows: 1, widths: ['*', 60], body: [header, ...body] },
    layout: 'register',
    fontSize: 7.8,
    margin: [0, 0, 0, 4],
  };
}

function exceptionTable(rows) {
  const header = [
    th('#', { align: 'right' }),
    th('Intern Code'),
    th('Name'),
    th('Department'),
    th('University'),
    th('Joined'),
    th('Ended'),
    th('Status'),
  ];

  const body = rows.map((row, i) => [
    { text: String(i + 1), alignment: 'right', color: COLOR.muted },
    { text: text(row.intern_code), fontSize: 7 },
    { text: text(row.full_name), bold: true },
    { text: text(row.department_name) },
    { text: text(row.university_name) },
    { text: fmtDate(row.joining_date), alignment: 'center', fontSize: 7 },
    { text: row.end_date ? fmtDate(row.end_date) : EMPTY, alignment: 'center', fontSize: 7 },
    { text: text(row.status), fontSize: 7 },
  ]);

  return {
    table: { headerRows: 1, widths: [16, 62, '*', '*', '*', 50, 50, 44], body: [header, ...body] },
    layout: 'register',
    fontSize: 7.4,
  };
}

/** Heading carrying the count and the remedial action for one check. */
function checkSection(check, index) {
  return [
    {
      margin: [0, 15, 0, 5],
      table: {
        widths: ['*'],
        body: [
          [
            {
              border: [false, false, false, true],
              borderColor: [COLOR.rule, COLOR.rule, COLOR.rule, COLOR.deep],
              margin: [0, 0, 0, 4],
              stack: [
                {
                  text: [
                    { text: `${index}. `, fontSize: 9, bold: true, color: COLOR.muted },
                    { text: check.title, fontSize: 9, bold: true, color: COLOR.ink },
                    {
                      text: `   ${fmtNumber(check.rows.length)} record${check.rows.length === 1 ? '' : 's'}`,
                      fontSize: 8,
                      bold: true,
                      color: COLOR.terminated,
                    },
                  ],
                },
                { text: `Action: ${check.action}`, fontSize: 7.5, color: COLOR.muted, margin: [0, 2, 0, 0] },
              ],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i) => (i === 1 ? 0.8 : 0),
        vLineWidth: () => 0,
        hLineColor: () => COLOR.deep,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      unbreakable: true,
    },
    exceptionTable(check.rows),
  ];
}

export default {
  id: 'data-quality',
  title: 'Data Quality Exception Report',
  code: 'OGDC/HR/INT-06',
  category: 'Exception report',
  scope: 'collection',
  orientation: 'portrait',
  description:
    'Records where the stored status and the stored dates disagree, or where mandatory information and documents are missing. Each exception is paired with the action that clears it.',
  parameters: [],

  data: (query) => dataQualityData(query),

  content(data) {
    const heading = titleBlock({
      title: 'Data Quality Exception Report',
      subtitle: `${fmtNumber(data.population)} record(s) examined against ${data.checks.length} checks`,
    });

    if (!data.population) return [heading, parameterBlock(data.parameters), noRecords()];

    const failing = data.checks.filter((c) => c.rows.length > 0);

    if (!failing.length) {
      return [
        heading,
        parameterBlock(data.parameters),
        summaryBar(data),
        checkIndex(data.checks),
        noRecords('No exceptions found. Every record passed all checks.'),
      ];
    }

    return [
      heading,
      parameterBlock(data.parameters),
      summaryBar(data),
      checkIndex(data.checks),
      {
        text: 'One record can appear under more than one check, so the section counts add up to more than the number of records needing attention.',
        style: 'note',
        margin: [0, 4, 0, 0],
      },
      ...failing.flatMap((check, i) => checkSection(check, i + 1)),
    ];
  },
};
