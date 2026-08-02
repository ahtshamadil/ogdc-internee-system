import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import archiver from 'archiver';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { backupTo, get } from '../db/index.js';
import { config } from '../config.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = fs
      .readdirSync(config.backupsDir)
      .filter((f) => f.endsWith('.zip'))
      .map((name) => {
        const stats = fs.statSync(path.join(config.backupsDir, name));
        return { name, size_bytes: stats.size, created_at: stats.mtime.toISOString() };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const counts = get(
      `SELECT (SELECT COUNT(*) FROM interns WHERE deleted_at IS NULL) AS interns,
              (SELECT COUNT(*) FROM documents) AS documents`,
    );

    res.json({ backups: files, dataDir: config.dataDir, counts });
  }),
);

/**
 * Snapshot = database + uploaded documents in one zip.
 *
 * The database is copied out with SQLite's online backup rather than reading
 * the .db file directly: with WAL enabled a plain file copy can capture a
 * torn state while the app is still serving requests.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = `ogdc-internees-backup-${stamp()}.zip`;
    const zipPath = path.join(config.backupsDir, name);
    const snapshotPath = path.join(config.backupsDir, `.snapshot-${Date.now()}.db`);

    await backupTo(snapshotPath);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      archive.file(snapshotPath, { name: 'internees.db' });
      if (fs.existsSync(config.uploadsDir)) archive.directory(config.uploadsDir, 'uploads');
      archive.append(
        JSON.stringify(
          { created_at: new Date().toISOString(), created_by: req.user.username, app: 'OGDC Internee Management System' },
          null,
          2,
        ),
        { name: 'backup-info.json' },
      );

      archive.finalize();
    });

    fs.rmSync(snapshotPath, { force: true });

    const stats = fs.statSync(zipPath);
    audit(req, { action: 'backup', entity: 'system', details: { name, size_bytes: stats.size } });

    res.json({ ok: true, backup: { name, size_bytes: stats.size, created_at: stats.mtime.toISOString() } });
  }),
);

router.get(
  '/:name',
  asyncHandler(async (req, res) => {
    const name = path.basename(req.params.name);
    const filePath = path.join(config.backupsDir, name);

    if (!name.endsWith('.zip') || !fs.existsSync(filePath)) throw httpError(404, 'Backup not found');

    audit(req, { action: 'download_backup', entity: 'system', details: { name } });
    res.download(filePath, name);
  }),
);

router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const name = path.basename(req.params.name);
    const filePath = path.join(config.backupsDir, name);

    if (!name.endsWith('.zip') || !fs.existsSync(filePath)) throw httpError(404, 'Backup not found');

    fs.rmSync(filePath, { force: true });
    audit(req, { action: 'delete_backup', entity: 'system', details: { name } });
    res.json({ ok: true });
  }),
);

export default router;
