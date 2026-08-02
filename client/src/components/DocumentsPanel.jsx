import { useState, useRef } from 'react';
import {
  Upload, FileText, FileType2, ImageIcon, Trash2, Download, Eye, X, ExternalLink,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatBytes, formatDateTime } from '../lib/format.js';
import { Button, Modal, EmptyState, Select, Skeleton, ConfirmDialog, Field } from './ui/index.jsx';
import { ACCEPT } from './InternDocumentPicker.jsx';

const DOC_TYPES = [
  { value: 'joining_letter', label: 'Joining Letter' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree', label: 'Degree' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'photo', label: 'Photograph' },
  { value: 'resume', label: 'Resume / CV' },
  { value: 'noc', label: 'NOC' },
  { value: 'completion_certificate', label: 'Completion Certificate' },
  { value: 'evaluation_form', label: 'Evaluation Form' },
  { value: 'other', label: 'Other' },
];

const isImage = (mime) => mime?.startsWith('image/');
const isPdf = (mime) => mime === 'application/pdf';
const isWord = (mime) =>
  mime === 'application/msword' ||
  mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Everything a browser can actually render in a frame. */
const canPreview = (mime) => isImage(mime) || isPdf(mime);

/** Icon and tint per file family, so a card is identifiable at a glance. */
function fileLook(mime) {
  if (isWord(mime)) return { Icon: FileType2, bg: 'var(--info-tint)', fg: 'var(--info-text)' };
  if (isPdf(mime)) return { Icon: FileText, bg: 'var(--danger-tint)', fg: 'var(--danger-text)' };
  return { Icon: ImageIcon, bg: 'var(--surface-sunken)', fg: 'var(--text-secondary)' };
}

/** Inline viewer -- PDFs in an iframe, images directly, Word offered as a download. */
function DocumentViewer({ doc, internId, onClose }) {
  if (!doc) return null;
  const src = `/api/interns/${internId}/documents/${doc.id}/file`;
  const look = fileLook(doc.mime_type);

  return (
    <Modal
      open
      onClose={onClose}
      title={doc.original_name}
      subtitle={`${doc.doc_type_label} · ${formatBytes(doc.size_bytes)}`}
      width={940}
      footer={
        <>
          <a href={`${src}?download=1`} className="btn btn-secondary" download>
            <Download size={15} /> Download
          </a>
          {canPreview(doc.mime_type) && (
            <a href={src} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <ExternalLink size={15} /> Open in new tab
            </a>
          )}
          <Button variant="primary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div
        style={{
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          minHeight: 380,
        }}
      >
        {isImage(doc.mime_type) ? (
          <img src={src} alt={doc.original_name} style={{ maxWidth: '100%', maxHeight: '68vh', display: 'block' }} />
        ) : isPdf(doc.mime_type) ? (
          <iframe src={src} title={doc.original_name} style={{ width: '100%', height: '68vh', border: 0 }} />
        ) : (
          /* Word documents cannot be shown in a browser -- say so plainly and
             hand over a download, rather than rendering an empty frame. */
          <div style={{ textAlign: 'center', padding: '56px 24px' }}>
            <div
              style={{
                width: 54, height: 54, borderRadius: 14, margin: '0 auto 14px',
                background: look.bg, color: look.fg, display: 'grid', placeItems: 'center',
              }}
            >
              <look.Icon size={25} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>Word documents open outside the browser</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 5, maxWidth: 360, marginInline: 'auto', lineHeight: 1.6 }}>
              Download “{doc.original_name}” to open it in Microsoft Word.
            </div>
            <a href={`${src}?download=1`} className="btn btn-primary mt-4" download style={{ marginTop: 16 }}>
              <Download size={15} /> Download document
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function DocumentsPanel({ internId, onChange }) {
  const { canEdit } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi(`/interns/${internId}/documents`);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState('joining_letter');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInput = useRef(null);

  const rows = data?.rows ?? [];

  const upload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('doc_type', docType);
      for (const file of files) body.append('files', file);

      const result = await api.post(`/interns/${internId}/documents`, body);
      toast.success(`${result.count} document${result.count === 1 ? '' : 's'} uploaded`);
      setUploadOpen(false);
      setFiles([]);
      reload();
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    await api.del(`/interns/${internId}/documents/${confirmDelete.id}`);
    toast.success('Document deleted');
    reload();
    onChange?.();
  };

  const addFiles = (list) => {
    setFiles((current) => [...current, ...Array.from(list)]);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${rows.length} document${rows.length === 1 ? '' : 's'} on file`}
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} h={84} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload the joining letter, transcript, degree, CNIC and photograph — PDF, Word or image — so the record is complete."
          action={canEdit && <Button variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button>}
        />
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}>
          {rows.map((doc) => (
            <div
              key={doc.id}
              className="card"
              style={{ padding: 12, transition: 'box-shadow 0.16s, transform 0.16s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewing(doc)}
                  style={{
                    width: 42, height: 42, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                    background: fileLook(doc.mime_type).bg,
                    color: fileLook(doc.mime_type).fg,
                    display: 'grid', placeItems: 'center', cursor: 'pointer', border: 0, padding: 0,
                  }}
                  title={canPreview(doc.mime_type) ? 'Preview' : 'Download'}
                >
                  {isImage(doc.mime_type) ? (
                    <img
                      src={`/api/interns/${internId}/documents/${doc.id}/file`}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (() => {
                      const { Icon } = fileLook(doc.mime_type);
                      return <Icon size={19} />;
                    })()
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{doc.doc_type_label}</div>
                  <div className="truncate-1" style={{ fontSize: 13, color: 'var(--text)' }} title={doc.original_name}>
                    {doc.original_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatBytes(doc.size_bytes)} · {doc.uploaded_by_name || 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--hairline)' }}>
                <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(doc)} title="Preview" />
                <a
                  href={`/api/interns/${internId}/documents/${doc.id}/file?download=1`}
                  className="btn btn-ghost btn-sm btn-icon"
                  download
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <div className="flex-1" />
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => setConfirmDelete(doc)}
                    title="Delete"
                    style={{ color: 'var(--danger-text)' }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- upload modal ---- */}
      <Modal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setFiles([]);
        }}
        title="Upload documents"
        subtitle="PDF, Word (.doc, .docx) or an image (JPG, PNG, WebP, GIF, BMP) — up to 10 MB each."
        width={520}
        footer={
          <>
            <Button onClick={() => { setUploadOpen(false); setFiles([]); }} disabled={uploading}>Cancel</Button>
            <Button variant="primary" icon={Upload} onClick={upload} loading={uploading} disabled={!files.length}>
              Upload {files.length > 0 && `(${files.length})`}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Document type">
            <Select value={docType} onChange={(e) => setDocType(e.target.value)} options={DOC_TYPES} />
          </Field>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
              padding: '26px 18px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.16s ease',
            }}
          >
            <Upload size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 14, fontWeight: 550 }}>
              Drop files here, or <span style={{ color: 'var(--primary)' }}>browse</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Joining letters, transcripts, degrees and photographs — you can select more than one
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(e) => addFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>

          {files.length > 0 && (
            <div className="grid gap-1.5">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: 'var(--surface-sunken)', fontSize: 13.5 }}
                >
                  {(() => {
                    // The picked file may have a vague type from the OS; fall
                    // back to the extension so the icon still makes sense.
                    const byName = /\.(docx?|DOCX?)$/.test(file.name)
                      ? 'application/msword'
                      : /\.pdf$/i.test(file.name)
                        ? 'application/pdf'
                        : file.type;
                    const { Icon } = fileLook(byName);
                    return <Icon size={14} />;
                  })()}
                  <span className="truncate-1 flex-1">{file.name}</span>
                  <span className="tnum" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((list) => list.filter((_, index) => index !== i))}
                    style={{ opacity: 0.55 }}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {viewing && <DocumentViewer doc={viewing} internId={internId} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        title="Delete this document?"
        message={`“${confirmDelete?.original_name}” will be permanently removed from the server. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}
