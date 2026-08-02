import fs from 'node:fs';
import express from 'express';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { upload, resolveStoredPath, DOC_TYPES, DOC_TYPE_LABELS, PREVIEWABLE } from '../middleware/upload.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get(
  '/types',
  asyncHandler(async (_req, res) => {
    res.json({ types: DOC_TYPES.map((value) => ({ value, label: DOC_TYPE_LABELS[value] })) });
  }),
);

router.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT d.id, d.doc_type, d.original_name, d.mime_type, d.size_bytes, d.uploaded_at,
              u.full_name AS uploaded_by_name
         FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
        WHERE d.intern_id = ? ORDER BY d.uploaded_at DESC, d.id DESC`,
      [Number(req.params.id)],
    );
    res.json({ rows: rows.map((r) => ({ ...r, doc_type_label: DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type })) });
  }),
);

router.post(
  '/:id/documents',
  requireRole('admin', 'hr'),
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const internId = Number(req.params.id);
    const intern = get('SELECT id, intern_code FROM interns WHERE id = ? AND deleted_at IS NULL', [internId]);

    if (!intern) {
      // The upload already hit disk before we could check; clean it up.
      for (const file of req.files ?? []) fs.rmSync(file.path, { force: true });
      throw httpError(404, 'Intern not found');
    }

    const docType = DOC_TYPES.includes(req.body.doc_type) ? req.body.doc_type : 'other';
    const files = req.files ?? [];
    if (!files.length) throw httpError(400, 'No file was uploaded');

    const created = [];
    for (const file of files) {
      const result = run(
        `INSERT INTO documents (intern_id, doc_type, original_name, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [internId, docType, file.originalname, file.filename, file.mimetype, file.size, req.user.id],
      );
      created.push(Number(result.lastInsertRowid));

      // A photo upload doubles as the intern's profile picture -- but only if
      // it is actually an image, or the avatar would point at a Word file.
      if (docType === 'photo' && file.mimetype.startsWith('image/')) {
        run('UPDATE interns SET photo_path = ? WHERE id = ?', [file.filename, internId]);
      }
    }

    audit(req, {
      action: 'upload',
      entity: 'document',
      entityId: created[0],
      details: {
        intern_id: internId,
        intern_code: intern.intern_code,
        doc_type: docType,
        files: files.map((f) => f.originalname),
      },
    });

    res.status(201).json({ ok: true, count: created.length });
  }),
);

/** The intern's profile photo, for avatars. Same auth gate as any document. */
router.get(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const intern = get('SELECT id, photo_path FROM interns WHERE id = ? AND deleted_at IS NULL', [
      Number(req.params.id),
    ]);
    if (!intern?.photo_path) throw httpError(404, 'No photo on file');

    const filePath = resolveStoredPath(intern.id, intern.photo_path);
    if (!fs.existsSync(filePath)) throw httpError(410, 'The stored photo is missing from disk');

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  }),
);

/**
 * Documents are served through this authenticated route and never from a static
 * directory -- CNIC scans and transcripts must not be fetchable by URL alone.
 */
router.get(
  '/:id/documents/:docId/file',
  asyncHandler(async (req, res) => {
    const doc = get('SELECT * FROM documents WHERE id = ? AND intern_id = ?', [
      Number(req.params.docId),
      Number(req.params.id),
    ]);
    if (!doc) throw httpError(404, 'Document not found');

    const filePath = resolveStoredPath(doc.intern_id, doc.stored_name);
    if (!fs.existsSync(filePath)) throw httpError(410, 'The stored file is missing from disk');

    // Word files cannot render in a browser tab, so they always download --
    // serving one "inline" just produces a blank frame.
    const disposition =
      req.query.download === '1' || !PREVIEWABLE(doc.mime_type) ? 'attachment' : 'inline';
    // Quotes in the filename would break the header; strip them.
    const safeName = doc.original_name.replace(/["\\]/g, '');

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).pipe(res);
  }),
);

router.delete(
  '/:id/documents/:docId',
  requireRole('admin', 'hr'),
  asyncHandler(async (req, res) => {
    const doc = get('SELECT * FROM documents WHERE id = ? AND intern_id = ?', [
      Number(req.params.docId),
      Number(req.params.id),
    ]);
    if (!doc) throw httpError(404, 'Document not found');

    run('DELETE FROM documents WHERE id = ?', [doc.id]);

    // If the deleted file was the one being used as the avatar, fall back to
    // the most recent remaining photograph rather than blanking the avatar
    // while other photos are still on file.
    if (doc.doc_type === 'photo') {
      const replacement = get(
        `SELECT stored_name FROM documents
          WHERE intern_id = ? AND doc_type = 'photo' AND mime_type LIKE 'image/%'
          ORDER BY uploaded_at DESC, id DESC LIMIT 1`,
        [doc.intern_id],
      );
      run('UPDATE interns SET photo_path = ? WHERE id = ? AND photo_path = ?', [
        replacement?.stored_name ?? null,
        doc.intern_id,
        doc.stored_name,
      ]);
    }

    try {
      fs.rmSync(resolveStoredPath(doc.intern_id, doc.stored_name), { force: true });
    } catch (err) {
      console.warn('[documents] could not remove file from disk:', err.message);
    }

    audit(req, {
      action: 'delete',
      entity: 'document',
      entityId: doc.id,
      details: { intern_id: doc.intern_id, original_name: doc.original_name, doc_type: doc.doc_type },
    });

    res.json({ ok: true });
  }),
);

export default router;
