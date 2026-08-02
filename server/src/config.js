import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(here, '..', '..');
const envPath = path.join(rootDir, '.env');

dotenv.config({ path: envPath, quiet: true });

/**
 * The signing secret must survive restarts, otherwise every deploy logs
 * everyone out. If .env has no secret we mint one and persist it, so a fresh
 * clone works with zero manual setup.
 */
function resolveJwtSecret() {
  const existing = process.env.JWT_SECRET?.trim();
  if (existing) return existing;

  const secret = crypto.randomBytes(48).toString('base64url');
  const line = `JWT_SECRET=${secret}\n`;
  try {
    if (fs.existsSync(envPath)) {
      const current = fs.readFileSync(envPath, 'utf8');
      fs.writeFileSync(
        envPath,
        /^JWT_SECRET=.*$/m.test(current)
          ? current.replace(/^JWT_SECRET=.*$/m, line.trim())
          : `${current.replace(/\n?$/, '\n')}${line}`,
      );
    } else {
      fs.writeFileSync(envPath, line);
    }
    console.log('[config] Generated a new JWT_SECRET into .env');
  } catch (err) {
    console.warn('[config] Could not persist JWT_SECRET, using an in-memory one:', err.message);
  }
  return secret;
}

const dataDir = path.resolve(process.env.DATA_DIR?.trim() || path.join(rootDir, 'server', 'data'));

export const config = {
  port: Number(process.env.PORT) || 4000,
  isProd: process.env.NODE_ENV === 'production',
  dataDir,
  dbPath: path.join(dataDir, 'internees.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  backupsDir: path.join(dataDir, 'backups'),
  clientDist: path.join(rootDir, 'client', 'dist'),
  jwtSecret: resolveJwtSecret(),
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024,
  sessionHours: 12,
};

for (const dir of [config.dataDir, config.uploadsDir, config.backupsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

// A syncing folder will corrupt SQLite. Warn loudly rather than fail silently.
// Match whole path segments -- a temp folder merely containing the word
// "OneDrive" in its name is not actually inside a synced tree.
const segments = config.dataDir.split(/[\\/]/);
if (segments.some((s) => /^(OneDrive|Dropbox|Google Drive|iCloudDrive)(\s|-|$)/i.test(s))) {
  console.warn(
    `\n[config] WARNING: DATA_DIR is inside a syncing folder:\n  ${config.dataDir}\n` +
      '  Sync clients lock files mid-write and can corrupt the SQLite database.\n' +
      '  Set DATA_DIR in .env to a local path such as C:\\OGDC-Internee-Data\n',
  );
}
