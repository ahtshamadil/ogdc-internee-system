import multer from 'multer';
import { ZodError } from 'zod';
import { config } from '../config.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

/* eslint-disable no-unused-vars */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    // Flatten to { field: message } so the form can highlight inputs directly.
    const fields = {};
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
    return res.status(400).json({ error: 'Please check the highlighted fields', fields });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`
        : err.message;
    return res.status(400).json({ error: message });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

/** Wrap an async route so a rejected promise reaches errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
