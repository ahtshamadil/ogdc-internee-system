/**
 * Internee Profile Sheet -- one page per internee.
 *
 * The document an HR file actually needs: every recorded field on one sheet,
 * plus a document checklist that shows what is *missing* as well as what is
 * held, and a signature block. This is the report type the previous
 * implementation had no equivalent for at all.
 */

import fs from 'node:fs';
import {
  COLOR, STATUS_COLOR, EMPTY, fmtDate, fmtDateTime, fmtCgpa, text,
  sectionHeading, fieldGrid, noRecords,
} from '../theme.js';
import { profileSheetData } from '../../services/reportDataService.js';
import { resolveStoredPath } from '../../middleware/upload.js';

const PHOTO_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/**
 * The photograph as a data URI.
 *
 * Read here rather than handed to pdfmake as a path: the renderer's local-file
 * policy refuses everything except the standard fonts, and it should stay that
 * way. Returns null on any problem -- a missing photo must not fail the report.
 */
function photoDataUri(intern) {
  if (!intern.photo_path) return null;
  try {
    const file = resolveStoredPath(intern.id, intern.photo_path);
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    const mime = PHOTO_MIME[ext];
    // pdfmake only decodes JPEG and PNG; anything else is skipped rather than
    // thrown, so a WebP profile picture degrades to the initials block.
    if (!mime || !fs.existsSync(file)) return null;
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Photograph if there is one, otherwise a labelled placeholder of equal size. */
function photoCell(intern) {
  const uri = photoDataUri(intern);
  if (uri) return { image: uri, width: 74, height: 88, fit: [74, 88] };

  return {
    stack: [
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 74, h: 88, lineWidth: 0.7, lineColor: COLOR.rule, color: COLOR.bandAlt },
        ],
      },
      {
        text: initials(intern.full_name),
        fontSize: 22,
        bold: true,
        color: COLOR.rule,
        alignment: 'center',
        margin: [0, -60, 0, 0],
      },
      {
        text: 'Photograph\nnot on file',
        fontSize: 5.6,
        color: COLOR.muted,
        alignment: 'center',
        margin: [0, 22, 0, 0],
      },
    ],
  };
}

function headerCard(intern) {
  return {
    table: {
      widths: [86, '*'],
      body: [
        [
          photoCell(intern),
          {
            stack: [
              { text: text(intern.full_name), fontSize: 16, bold: true, color: COLOR.ink },
              {
                margin: [0, 3, 0, 0],
                text: [
                  { text: text(intern.intern_code), fontSize: 8.5, color: COLOR.secondary },
                  { text: '     Status: ', fontSize: 8.5, color: COLOR.muted },
                  {
                    text: text(intern.status),
                    fontSize: 8.5,
                    bold: true,
                    color: STATUS_COLOR[intern.status] ?? COLOR.ink,
                  },
                ],
              },
              {
                margin: [0, 9, 0, 0],
                columns: [
                  {
                    width: '*',
                    stack: [
                      { text: 'DEPARTMENT', fontSize: 6.2, color: COLOR.muted, characterSpacing: 0.4 },
                      { text: text(intern.department_name), fontSize: 9, margin: [0, 1, 0, 0] },
                    ],
                  },
                  {
                    width: '*',
                    stack: [
                      { text: 'SUPERVISOR', fontSize: 6.2, color: COLOR.muted, characterSpacing: 0.4 },
                      { text: text(intern.supervisor_name), fontSize: 9, margin: [0, 1, 0, 0] },
                    ],
                  },
                  {
                    width: 'auto',
                    stack: [
                      { text: 'PERIOD', fontSize: 6.2, color: COLOR.muted, characterSpacing: 0.4 },
                      {
                        text: `${fmtDate(intern.joining_date)}  to  ${intern.end_date ? fmtDate(intern.end_date) : EMPTY}`,
                        fontSize: 9,
                        margin: [0, 1, 0, 0],
                      },
                    ],
                  },
                  {
                    width: 'auto',
                    stack: [
                      { text: 'DURATION', fontSize: 6.2, color: COLOR.muted, characterSpacing: 0.4 },
                      {
                        text: intern.duration_weeks ? `${intern.duration_weeks} weeks` : EMPTY,
                        fontSize: 9,
                        margin: [0, 1, 0, 0],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      ],
    },
    layout: 'card',
    margin: [0, 0, 0, 4],
  };
}

/** Held / not held, per mandatory document type. */
function checklistTable(checklist, documents) {
  const held = new Map();
  for (const doc of documents) if (!held.has(doc.doc_type)) held.set(doc.doc_type, doc);

  const body = [
    [
      { text: 'MANDATORY DOCUMENT', style: 'th' },
      { text: 'ON FILE', style: 'th', alignment: 'center' },
      { text: 'FILE NAME', style: 'th' },
      { text: 'UPLOADED', style: 'th', alignment: 'center' },
    ],
    ...checklist.map((item) => {
      const doc = held.get(item.type);
      return [
        { text: item.label },
        {
          text: item.present ? 'Yes' : 'MISSING',
          alignment: 'center',
          bold: true,
          color: item.present ? COLOR.active : COLOR.terminated,
        },
        { text: doc ? text(doc.original_name) : EMPTY, color: doc ? COLOR.ink : COLOR.muted, fontSize: 7 },
        { text: doc ? fmtDateTime(doc.uploaded_at) : EMPTY, alignment: 'center', color: COLOR.muted, fontSize: 7 },
      ];
    }),
  ];

  return { table: { headerRows: 1, widths: ['*', 46, '*', 78], body }, layout: 'register', fontSize: 7.6 };
}

/** Three ruled signature lines — the sheet is meant to be signed on paper. */
function signatureBlock() {
  const line = (role) => ({
    width: '*',
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.7, lineColor: COLOR.secondary }] },
      { text: role, fontSize: 7, color: COLOR.muted, margin: [0, 4, 0, 0] },
      { text: 'Name, signature & date', fontSize: 6, color: COLOR.rule, margin: [0, 1, 0, 0] },
    ],
  });

  return {
    margin: [0, 34, 0, 0],
    columns: [line('Prepared by (HR)'), line('Verified by (Supervisor)'), line('Approved by (Head of Department)')],
  };
}

export default {
  id: 'profile-sheet',
  title: 'Internee Profile Sheet',
  code: 'OGDC/HR/INT-02',
  category: 'Per-record document',
  scope: 'record',
  orientation: 'portrait',
  description:
    'A complete one-page record for a single internee: all personal, academic, placement and completion details, plus a mandatory-document checklist and signature block.',
  parameters: [{ key: 'id', label: 'Internee', type: 'intern', required: true }],

  data: (query) => profileSheetData(query.id),

  titleFor: (data) => (data?.intern ? `Internee Profile Sheet - ${data.intern.full_name}` : 'Internee Profile Sheet'),

  content(data) {
    if (!data?.intern) return [noRecords('The selected internee record could not be found.')];
    const i = data.intern;

    return [
      headerCard(i),

      sectionHeading('Personal details', { top: 12 }),
      fieldGrid([
        { label: "Father's name", value: i.father_name },
        { label: 'CNIC', value: i.cnic },
        { label: 'Gender', value: i.gender },
        { label: 'Date of birth', value: i.dob ? fmtDate(i.dob) : null },
      ], { columns: 4 }),

      sectionHeading('Contact'),
      fieldGrid([
        { label: 'Phone', value: i.phone },
        { label: 'Email', value: i.email },
        { label: 'Home city', value: i.city_name },
        { label: 'Province', value: i.city_province },
        { label: 'Address', value: i.address },
        { label: 'Emergency contact', value: i.emergency_contact_name },
        { label: 'Emergency phone', value: i.emergency_contact_phone },
        { label: 'Referred by', value: i.referred_by },
      ], { columns: 4 }),

      sectionHeading('Education'),
      fieldGrid([
        { label: 'University', value: i.university_name },
        { label: 'Degree', value: i.degree_name },
        { label: 'Qualification level', value: i.degree_level },
        { label: 'Major', value: i.major },
        { label: 'Semester', value: i.semester },
        { label: 'CGPA', value: fmtCgpa(i.cgpa) },
        { label: 'Enrollment no', value: i.enrollment_no },
      ], { columns: 4 }),

      sectionHeading('OGDC placement'),
      fieldGrid([
        { label: 'Department', value: i.department_name },
        { label: 'Department code', value: i.department_code },
        { label: 'Supervisor', value: i.supervisor_name },
        { label: 'Designation', value: i.supervisor_designation },
      ], { columns: 4 }),

      sectionHeading('Internship period & completion'),
      fieldGrid([
        { label: 'Joining date', value: fmtDate(i.joining_date) },
        { label: 'End date', value: i.end_date ? fmtDate(i.end_date) : null },
        { label: 'Duration', value: i.duration_weeks ? `${i.duration_weeks} weeks` : null },
        { label: 'Status', value: i.status },
        { label: 'Certificate issued', value: i.certificate_issued ? 'Yes' : 'No' },
        { label: 'Certificate no', value: i.certificate_no },
        { label: 'Certificate date', value: i.certificate_date ? fmtDate(i.certificate_date) : null },
        { label: 'Evaluation rating', value: i.evaluation_rating ? `${i.evaluation_rating} out of 5` : null },
      ], { columns: 4 }),

      ...(i.evaluation_remarks
        ? [
            sectionHeading('Supervisor remarks'),
            { text: text(i.evaluation_remarks), fontSize: 8.5, color: COLOR.secondary, lineHeight: 1.35 },
          ]
        : []),

      ...(i.notes
        ? [
            sectionHeading('Internal notes'),
            { text: text(i.notes), fontSize: 8.5, color: COLOR.secondary, lineHeight: 1.35 },
          ]
        : []),

      sectionHeading('Document checklist'),
      checklistTable(data.checklist, data.documents),
      data.missing.length
        ? {
            text: `${data.missing.length} mandatory document(s) missing: ${data.missing.map((m) => m.label).join(', ')}.`,
            fontSize: 7.5,
            bold: true,
            color: COLOR.terminated,
            margin: [0, 6, 0, 0],
          }
        : {
            text: 'All mandatory documents are on file.',
            fontSize: 7.5,
            color: COLOR.active,
            margin: [0, 6, 0, 0],
          },

      {
        text: `Record created by ${text(i.created_by_name)} on ${fmtDateTime(i.created_at)}.`,
        style: 'note',
        margin: [0, 12, 0, 0],
      },

      signatureBlock(),
    ];
  },
};
