import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';

/**
 * Uploads land in DATA_DIR/uploads/<intern_id>/ under a generated name.
 *
 * The original filename is stored in the database for display only and never
 * reaches the filesystem -- that closes off path traversal and duplicate-name
 * clobbering in one move.
 */
const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  // GIF and BMP render natively in every browser, so there is no reason to
  // turn away a scanned photo that happens to be saved in one of them.
  ['image/gif', '.gif'],
  ['image/bmp', '.bmp'],
]);

/**
 * Formats browsers cannot display, so accepting one would store a photograph
 * that renders as a broken image everywhere. Rejected on purpose -- but with
 * an explanation, because .heic is what an iPhone produces by default and
 * "cannot be uploaded" alone would be baffling.
 */
const UNSUPPORTED_IMAGE_HELP = new Map([
  ['.heic', 'iPhone photos (.heic) cannot be displayed by web browsers. On the iPhone: Settings → Camera → Formats → “Most Compatible”, or export the picture as JPEG first.'],
  ['.heif', 'HEIF images (.heif) cannot be displayed by web browsers. Save the picture as JPEG or PNG first.'],
  ['.tif', 'TIFF images (.tif) cannot be displayed by web browsers. Save the picture as JPEG or PNG first.'],
  ['.tiff', 'TIFF images (.tiff) cannot be displayed by web browsers. Save the picture as JPEG or PNG first.'],
]);

/**
 * Extensions we accept, and the MIME type to record for each.
 *
 * Windows and some browsers send `application/octet-stream` (or an empty type)
 * for .doc/.docx rather than the official type, which would reject a perfectly
 * good joining letter. So the extension is the second gate: if the browser is
 * vague about the type but the extension is one of ours, the file is accepted
 * and stored under the canonical MIME type instead of the vague one.
 */
const ALLOWED_EXTENSIONS = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
]);

const VAGUE_TYPES = new Set(['application/octet-stream', 'application/x-msdownload', '', undefined]);

/** Canonical MIME for a file, or null if it is not something we accept. */
function resolveMimeType(file) {
  if (ALLOWED.has(file.mimetype)) return file.mimetype;

  const ext = path.extname(file.originalname || '').toLowerCase();
  const byExtension = ALLOWED_EXTENSIONS.get(ext);
  // Only trust the extension when the browser gave us nothing useful --
  // never when it positively declared a type we do not accept.
  if (byExtension && VAGUE_TYPES.has(file.mimetype)) return byExtension;

  return null;
}

export const ALLOWED_MIME_TYPES = [...ALLOWED.keys()];
export const ALLOWED_EXTENSION_LIST = [...ALLOWED_EXTENSIONS.keys()];

/** Word files cannot render in a browser tab -- the UI offers a download instead. */
export const PREVIEWABLE = (mime) => mime === 'application/pdf' || mime?.startsWith('image/');

export const DOC_TYPES = [
  'joining_letter',
  'transcript',
  'degree',
  'cnic',
  'photo',
  'resume',
  'noc',
  'completion_certificate',
  'evaluation_form',
  'other',
];

export const DOC_TYPE_LABELS = {
  joining_letter: 'Joining Letter',
  transcript: 'Transcript',
  degree: 'Degree',
  cnic: 'CNIC',
  photo: 'Photograph',
  resume: 'Resume / CV',
  noc: 'NOC',
  completion_certificate: 'Completion Certificate',
  evaluation_form: 'Evaluation Form',
  other: 'Other',
};

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const internId = Number(req.params.id);
    if (!Number.isInteger(internId) || internId <= 0) return cb(new Error('Invalid intern id'));
    const dir = path.join(config.uploadsDir, String(internId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    // resolveMimeType already ran in fileFilter, so this is never null here.
    const ext = ALLOWED.get(resolveMimeType(file)) ?? '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 10 },
  fileFilter(_req, file, cb) {
    const mime = resolveMimeType(file);
    if (!mime) {
      // Tagged 400 so the user is told which file was refused and why -- a bare
      // Error would surface as a generic "something went wrong".
      const ext = path.extname(file.originalname || '').toLowerCase();
      const specificHelp = UNSUPPORTED_IMAGE_HELP.get(ext);

      const err = new Error(
        specificHelp
          ? `“${file.originalname}” could not be uploaded. ${specificHelp}`
          : `“${file.originalname}” cannot be uploaded. Accepted files: PDF, Word (.doc, .docx), and images (JPG, PNG, WebP, GIF, BMP).`,
      );
      err.status = 400;
      return cb(err);
    }
    // Record the canonical type, not whatever vague type the browser guessed,
    // so the file is served back correctly later.
    file.mimetype = mime;
    cb(null, true);
  },
});

/** Resolve a stored document to an absolute path, refusing anything outside uploads. */
export function resolveStoredPath(internId, storedName) {
  const base = path.join(config.uploadsDir, String(Number(internId)));
  const full = path.resolve(base, storedName);
  if (!full.startsWith(path.resolve(base) + path.sep)) throw new Error('Invalid document path');
  return full;
}
