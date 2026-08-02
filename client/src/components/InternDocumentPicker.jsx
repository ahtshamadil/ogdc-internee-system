import { useRef, useState } from 'react';
import { Upload, X, FileText, FileType2, ImageIcon, UserRound, Trash2 } from 'lucide-react';
import { formatBytes } from '../lib/format.js';
import { Button, Select } from './ui/index.jsx';

export const DOC_TYPE_OPTIONS = [
  { value: 'joining_letter', label: 'Joining Letter' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree', label: 'Degree' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'resume', label: 'Resume / CV' },
  { value: 'noc', label: 'NOC' },
  { value: 'completion_certificate', label: 'Completion Certificate' },
  { value: 'evaluation_form', label: 'Evaluation Form' },
  { value: 'photo', label: 'Photograph' },
  { value: 'other', label: 'Other' },
];

/**
 * Deliberately lists exact types rather than `image/*`.
 *
 * A wildcard lets the file dialog offer .heic, .tiff and friends, which the
 * server then refuses -- so the picker would be advertising files that cannot
 * actually be uploaded. Keep this in step with the server's allowlist.
 */
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp';

export const ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,' +
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document,${IMAGE_ACCEPT}`;

const isWordName = (name) => /\.docx?$/i.test(name);
const isPdfName = (name) => /\.pdf$/i.test(name);

function fileLook(name, type) {
  if (isWordName(name)) return { Icon: FileType2, bg: 'var(--info-tint)', fg: 'var(--info-text)' };
  if (isPdfName(name) || type === 'application/pdf') return { Icon: FileText, bg: 'var(--danger-tint)', fg: 'var(--danger-text)' };
  return { Icon: ImageIcon, bg: 'var(--surface-sunken)', fg: 'var(--text-secondary)' };
}

/** Guess the document type from the filename so HR usually needn't touch the dropdown. */
function guessDocType(name) {
  const n = name.toLowerCase();
  if (/joining|offer|appoint/.test(n)) return 'joining_letter';
  if (/transcript|marks|result/.test(n)) return 'transcript';
  if (/degree|diploma/.test(n)) return 'degree';
  if (/cnic|nic|identity/.test(n)) return 'cnic';
  if (/resume|cv/.test(n)) return 'resume';
  if (/noc/.test(n)) return 'noc';
  if (/certificate|completion/.test(n)) return 'completion_certificate';
  if (/evaluation|appraisal/.test(n)) return 'evaluation_form';
  if (/photo|picture|pic|image|dp/.test(n)) return 'photo';
  if (/\.(jpe?g|png|webp)$/i.test(n)) return 'photo';
  return 'other';
}

let nextKey = 1;

/**
 * Stages a photograph and any number of documents while the internee record is
 * being filled in.
 *
 * Documents are stored against an internee id, which does not exist until the
 * record is saved -- so on a new record the files are held here and uploaded
 * immediately after the record is created, which keeps it one action for the
 * person doing the data entry.
 */
export default function InternDocumentPicker({
  photo,
  onPhotoChange,
  documents,
  onDocumentsChange,
  existingPhotoUrl,
  existingCount = 0,
}) {
  const photoInput = useRef(null);
  const fileInput = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (list) => {
    const added = Array.from(list).map((file) => ({
      key: nextKey++,
      file,
      doc_type: guessDocType(file.name),
    }));
    onDocumentsChange([...documents, ...added]);
  };

  const photoPreview = photo ? URL.createObjectURL(photo) : existingPhotoUrl;

  return (
    <div className="grid gap-5" style={{ gridColumn: '1 / -1' }}>
      {/* ---- photograph ---- */}
      <div className="flex items-center gap-4 flex-wrap">
        <div
          className="avatar"
          style={{ width: 78, height: 78, borderRadius: 18, fontSize: 25, flexShrink: 0 }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <UserRound size={30} strokeWidth={1.6} />
          )}
        </div>

        <div className="min-w-0">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Internee photograph</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, marginBottom: 8 }}>
            JPG, PNG, WebP, GIF or BMP. Shown on the internee's profile.
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" icon={Upload} onClick={() => photoInput.current?.click()}>
              {photoPreview ? 'Change photo' : 'Choose photo'}
            </Button>
            {photo && (
              <Button size="sm" variant="ghost" icon={X} onClick={() => onPhotoChange(null)}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPhotoChange(file);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* ---- documents ---- */}
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? 'var(--primary)' : 'var(--hairline-strong)'}`,
            background: dragging ? 'var(--primary-tint)' : 'var(--surface-sunken)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 18px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.16s ease',
          }}
        >
          <Upload size={21} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 14, fontWeight: 550 }}>
            Drop files here, or <span style={{ color: 'var(--primary)' }}>browse</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Joining letter, transcript, degree, CNIC — PDF, Word or image, up to 10 MB each
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </div>

        {existingCount > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            {existingCount} document{existingCount === 1 ? '' : 's'} already attached — anything you add here
            is on top of those.
          </div>
        )}

        {documents.length > 0 && (
          <div className="grid gap-1.5 mt-3">
            {documents.map((entry) => {
              const look = fileLook(entry.file.name, entry.file.type);
              return (
                <div
                  key={entry.key}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                  style={{ background: 'var(--surface-sunken)' }}
                >
                  <div
                    style={{
                      width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                      background: look.bg, color: look.fg,
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <look.Icon size={15} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate-1" style={{ fontSize: 13.5, fontWeight: 550 }} title={entry.file.name}>
                      {entry.file.name}
                    </div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatBytes(entry.file.size)}
                    </div>
                  </div>

                  <Select
                    value={entry.doc_type}
                    onChange={(e) =>
                      onDocumentsChange(
                        documents.map((d) => (d.key === entry.key ? { ...d, doc_type: e.target.value } : d)),
                      )
                    }
                    options={DOC_TYPE_OPTIONS}
                    className="select-sm" style={{ width: 178 }}
                    aria-label={`Document type for ${entry.file.name}`}
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    title="Remove"
                    style={{ color: 'var(--danger-text)' }}
                    onClick={() => onDocumentsChange(documents.filter((d) => d.key !== entry.key))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
