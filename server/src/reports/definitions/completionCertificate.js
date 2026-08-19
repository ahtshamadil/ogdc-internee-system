/**
 * Internship Completion Certificate.
 *
 * The only outward-facing document in the catalogue -- it is handed to the
 * internee -- so it drops the internal running header and the "confidential"
 * footer and stands as a formal certificate on its own.
 *
 * The schema has carried certificate_no, certificate_date and
 * evaluation_rating since the beginning; until now nothing printed them.
 */

import { COLOR, EMPTY, LOGO_SVG, ORGANISATION, fmtDate, text, noRecords } from '../theme.js';
import { completionCertificateData } from '../../services/reportDataService.js';

const RATING_WORD = {
  5: 'Outstanding',
  4: 'Very Good',
  3: 'Good',
  2: 'Satisfactory',
  1: 'Fair',
};

/** Double rule, drawn the full width of the text block. */
function ornament(width = 500) {
  return {
    margin: [0, 0, 0, 0],
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1.4, lineColor: COLOR.deep },
      { type: 'line', x1: 0, y1: 3.2, x2: width, y2: 3.2, lineWidth: 0.5, lineColor: COLOR.teal },
    ],
  };
}

function signatureBlock() {
  const line = (role, sub) => ({
    width: '*',
    alignment: 'center',
    stack: [
      { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 175, y2: 0, lineWidth: 0.8, lineColor: COLOR.ink }] },
      { text: role, fontSize: 8.5, bold: true, color: COLOR.ink, margin: [0, 5, 0, 0] },
      { text: sub, fontSize: 7, color: COLOR.muted, margin: [0, 1, 0, 0] },
    ],
  });

  return {
    margin: [0, 58, 0, 0],
    columns: [line('Supervisor', 'Name & designation'), line('General Manager (HR)', ORGANISATION)],
  };
}

export default {
  id: 'completion-certificate',
  title: 'Internship Completion Certificate',
  code: 'OGDC/HR/INT-03',
  category: 'Per-record document',
  scope: 'record',
  orientation: 'portrait',
  plain: true,
  description:
    'The formal completion certificate for an individual internee, on OGDC letterhead with certificate number, period served, department and signature blocks.',
  parameters: [{ key: 'id', label: 'Internee', type: 'intern', required: true }],

  data: (query) => completionCertificateData(query.id),

  titleFor: (data) =>
    data?.intern ? `Internship Completion Certificate - ${data.intern.full_name}` : 'Internship Completion Certificate',

  /**
   * Traceability without the internal-use wording. Suppressed when no
   * certificate is actually being issued -- a footer citing an empty
   * certificate number on a refusal page is worse than no footer.
   */
  footnoteFor: (data) => {
    const i = data?.intern;
    if (!i || i.status !== 'Completed') return '';
    return `Certificate ${text(i.certificate_no)} · Internee ${text(i.intern_code)} · Issued by ${ORGANISATION} · Verify against the Internee Management System record.`;
  },

  content(data) {
    if (!data?.intern) return [noRecords('The selected internee record could not be found.')];
    const i = data.intern;

    // A certificate for someone who has not completed would be a false record.
    // Refuse plainly and say what has to change first.
    if (i.status !== 'Completed') {
      return [
        { svg: LOGO_SVG, width: 130, alignment: 'center', margin: [0, 40, 0, 24] },
        noRecords('No certificate can be issued for this internee.', null),
        {
          text: `${text(i.full_name)} (${text(i.intern_code)}) is currently marked "${text(i.status)}". A completion certificate can only be produced once the internship status is set to Completed.`,
          fontSize: 9,
          alignment: 'center',
          color: COLOR.secondary,
          margin: [40, 0, 40, 0],
        },
      ];
    }

    const period = `${fmtDate(i.joining_date)} to ${i.end_date ? fmtDate(i.end_date) : EMPTY}`;
    const duration = i.duration_weeks ? `${i.duration_weeks} weeks` : null;

    return [
      { svg: LOGO_SVG, width: 126, alignment: 'center', margin: [0, 6, 0, 4] },
      { text: 'the energy', fontSize: 9, color: COLOR.blue, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        text: ORGANISATION.toUpperCase(),
        fontSize: 12,
        bold: true,
        alignment: 'center',
        color: COLOR.ink,
        characterSpacing: 1,
      },
      {
        text: 'Human Resource Department',
        fontSize: 8.5,
        color: COLOR.muted,
        alignment: 'center',
        margin: [0, 2, 0, 18],
      },

      ornament(),
      {
        text: 'CERTIFICATE OF INTERNSHIP COMPLETION',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        color: COLOR.deep,
        characterSpacing: 1.1,
        margin: [0, 14, 0, 12],
      },
      ornament(),

      {
        text: 'This is to certify that',
        fontSize: 10,
        italics: true,
        alignment: 'center',
        color: COLOR.secondary,
        margin: [0, 26, 0, 10],
      },
      {
        text: text(i.full_name),
        fontSize: 22,
        bold: true,
        alignment: 'center',
        color: COLOR.ink,
      },
      {
        text: i.father_name ? `son/daughter of ${text(i.father_name)}` : '',
        fontSize: 9,
        alignment: 'center',
        color: COLOR.muted,
        margin: [0, 4, 0, 0],
      },
      {
        text: i.cnic ? `CNIC ${text(i.cnic)}` : '',
        fontSize: 8.5,
        alignment: 'center',
        color: COLOR.muted,
        margin: [0, 2, 0, 16],
      },

      {
        margin: [30, 0, 30, 0],
        alignment: 'center',
        lineHeight: 1.55,
        text: [
          { text: 'has successfully completed an internship at ', fontSize: 10.5, color: COLOR.ink },
          { text: ORGANISATION, fontSize: 10.5, bold: true, color: COLOR.ink },
          { text: ' in the ', fontSize: 10.5, color: COLOR.ink },
          { text: text(i.department_name), fontSize: 10.5, bold: true, color: COLOR.ink },
          { text: ' department, from ', fontSize: 10.5, color: COLOR.ink },
          { text: period, fontSize: 10.5, bold: true, color: COLOR.ink },
          duration ? { text: ` (${duration})`, fontSize: 10.5, color: COLOR.ink } : {},
          { text: '.', fontSize: 10.5, color: COLOR.ink },
        ],
      },

      i.university_name
        ? {
            margin: [30, 10, 30, 0],
            alignment: 'center',
            fontSize: 10,
            color: COLOR.secondary,
            text: `At the time of the internship the candidate was enrolled at ${text(i.university_name)}${i.degree_name ? ` in the ${text(i.degree_name)} programme` : ''}.`,
          }
        : {},

      i.evaluation_rating
        ? {
            margin: [30, 14, 30, 0],
            alignment: 'center',
            fontSize: 10,
            color: COLOR.ink,
            text: [
              { text: 'Overall performance was assessed as ' },
              {
                text: `${RATING_WORD[i.evaluation_rating] ?? ''} (${i.evaluation_rating} out of 5)`,
                bold: true,
                color: COLOR.deep,
              },
              { text: '.' },
            ],
          }
        : {},

      {
        margin: [0, 30, 0, 0],
        alignment: 'center',
        table: {
          widths: ['auto', 'auto', 'auto'],
          body: [
            [
              { text: 'CERTIFICATE NO.', fontSize: 6.5, color: COLOR.muted, characterSpacing: 0.4, alignment: 'center' },
              { text: 'DATE OF ISSUE', fontSize: 6.5, color: COLOR.muted, characterSpacing: 0.4, alignment: 'center' },
              { text: 'INTERNEE CODE', fontSize: 6.5, color: COLOR.muted, characterSpacing: 0.4, alignment: 'center' },
            ],
            [
              { text: text(i.certificate_no), fontSize: 10, bold: true, alignment: 'center' },
              {
                text: i.certificate_date ? fmtDate(i.certificate_date) : fmtDate(i.end_date),
                fontSize: 10,
                bold: true,
                alignment: 'center',
              },
              { text: text(i.intern_code), fontSize: 10, bold: true, alignment: 'center' },
            ],
          ],
        },
        layout: 'card',
      },

      signatureBlock(),
    ];
  },
};
