import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { seed } from './db/seed.js';
import { attachUser } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import internRoutes from './routes/interns.js';
import documentRoutes from './routes/documents.js';
import analyticsRoutes from './routes/analytics.js';
import lookupRoutes from './routes/lookups.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import backupRoutes from './routes/backup.js';

// Schema and lookups are brought up to date on every start, so deploying is
// "copy the folder and run" with no separate migration step to forget.
const { admin } = seed({ verbose: true });

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' })); // headroom for pasted CSV imports
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/interns', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backups', backupRoutes);

app.use('/api', notFound);

// In production the same process serves the built frontend, so the LAN has one
// URL and one port to remember.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
} else if (config.isProd) {
  console.warn('[server] client/dist not found -- run "npm run build" to serve the frontend');
}

app.use(errorHandler);

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

// 0.0.0.0 rather than localhost: the whole point is that other machines on the
// OGDC network can reach it.
app.listen(config.port, '0.0.0.0', () => {
  const addresses = localAddresses();
  console.log('\n  OGDC Internee Management System');
  console.log(`  ${'-'.repeat(44)}`);
  console.log(`  Local        http://localhost:${config.port}`);
  for (const address of addresses) console.log(`  On this LAN  http://${address}:${config.port}`);
  console.log(`  Data folder  ${config.dataDir}`);
  if (!fs.existsSync(config.clientDist)) {
    console.log('  Frontend     dev mode -- open the Vite URL (http://localhost:5174)');
  }
  if (admin) console.log('\n  First run: sign in with the administrator password printed above.');
  console.log('');
});
