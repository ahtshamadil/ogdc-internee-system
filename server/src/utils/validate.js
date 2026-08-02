import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Use a valid date');

/** Empty strings from HTML inputs should become NULL, not ''. */
const blankToNull = (schema) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable());

const optionalText = (max = 255) => blankToNull(z.string().trim().max(max));

const optionalId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().int().positive().nullable(),
);

const optionalNumber = (schema) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), schema.nullable());

export const STATUSES = ['Upcoming', 'Active', 'Completed', 'Terminated', 'Extended'];

export const internSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Name is required').max(120),
    father_name: optionalText(120),
    // 13 digits, with or without the conventional dashes.
    cnic: blankToNull(
      z
        .string()
        .trim()
        .regex(/^\d{5}-?\d{7}-?\d$/, 'CNIC should be 13 digits, e.g. 61101-1234567-1'),
    ),
    gender: blankToNull(z.enum(['Male', 'Female', 'Other'])),
    dob: blankToNull(isoDate),

    phone: blankToNull(z.string().trim().regex(/^[\d\s+\-()]{7,20}$/, 'Enter a valid phone number')),
    email: blankToNull(z.string().trim().email('Enter a valid email address')),
    address: optionalText(400),
    city_id: optionalId,
    emergency_contact_name: optionalText(120),
    emergency_contact_phone: blankToNull(
      z.string().trim().regex(/^[\d\s+\-()]{7,20}$/, 'Enter a valid phone number'),
    ),
    referred_by: optionalText(120),

    university_id: optionalId,
    degree_id: optionalId,
    major: optionalText(120),
    semester: optionalText(40),
    cgpa: optionalNumber(z.number().min(0, 'CGPA cannot be negative').max(4.0, 'CGPA cannot exceed 4.00')),
    enrollment_no: optionalText(60),

    department_id: optionalId,
    supervisor_id: optionalId,

    joining_date: isoDate,
    end_date: blankToNull(isoDate),
    status: z.enum(STATUSES).default('Active'),

    certificate_issued: z.preprocess((v) => (v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0), z.number()),
    certificate_date: blankToNull(isoDate),
    certificate_no: optionalText(60),
    evaluation_rating: optionalNumber(z.number().int().min(1).max(5)),
    evaluation_remarks: optionalText(2000),
    notes: optionalText(2000),
  })
  .refine((d) => !d.end_date || d.end_date >= d.joining_date, {
    message: 'End date cannot be before the joining date',
    path: ['end_date'],
  })
  .refine((d) => !d.certificate_issued || d.certificate_date, {
    message: 'Give the date the certificate was issued',
    path: ['certificate_date'],
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'The two passwords do not match',
    path: ['confirm_password'],
  });

export const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only'),
  full_name: z.string().trim().min(2, 'Full name is required').max(120),
  role: z.enum(['admin', 'hr', 'viewer']),
  password: z.string().min(8, 'Use at least 8 characters').optional(),
  is_active: z.preprocess((v) => (v === false || v === 'false' || v === 0 || v === '0' ? 0 : 1), z.number()),
});

export const lookupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  short_name: optionalText(40),
  city: optionalText(80),
  province: optionalText(60),
  level: optionalText(40),
  code: optionalText(20),
  designation: optionalText(120),
  department_id: optionalId,
  email: blankToNull(z.string().trim().email('Enter a valid email address')),
  phone: optionalText(30),
  is_active: z.preprocess((v) => (v === false || v === 'false' || v === 0 || v === '0' ? 0 : 1), z.number()),
});

/** Weeks between two ISO dates, inclusive of the joining day. */
export function weeksBetween(start, end) {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.max(1, Math.round(ms / (7 * 86400000)));
}
