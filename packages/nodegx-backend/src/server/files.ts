/**
 * Parse-wire file routes: upload/serve/delete beside the SQLite data dir.
 *
 *   POST   /files/:name   raw body -> { url, name } (201)
 *   GET    /files/:name   serve bytes
 *   DELETE /files/:name   remove
 *
 * Stored under `<dataDir>/files/<random>_<sanitized-name>` — the random prefix
 * is what Parse does too (uploading `a.png` twice must yield two files), and
 * the returned `name` is the stored name the client hands back for delete.
 * Content types are re-derived from the file extension on serve; a `.meta.json`
 * sidecar was deliberately skipped (recorded simplification).
 *
 * @module nodegx-backend/server/files
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';

import { CORS_HEADERS, HttpError, readRawBody, sendJSON } from './http-util';

const EXT_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function sanitizeName(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export class FileRoutes {
  private readonly filesDir: string;
  /** Base URL clients can reach us on, e.g. http://127.0.0.1:8578 */
  private baseUrl: string;

  constructor(dataDir: string, baseUrl: string) {
    this.filesDir = path.join(dataDir, 'files');
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private resolveStored(name: string): string {
    const stored = path.join(this.filesDir, sanitizeName(name));
    // sanitizeName strips separators, but keep the guard explicit.
    if (!stored.startsWith(this.filesDir)) throw new HttpError(400, 'Invalid file name');
    return stored;
  }

  async upload(req: http.IncomingMessage, res: http.ServerResponse, name: string): Promise<void> {
    const body = await readRawBody(req);
    fs.mkdirSync(this.filesDir, { recursive: true });

    const storedName = `${crypto.randomBytes(8).toString('hex')}_${sanitizeName(name)}`;
    fs.writeFileSync(path.join(this.filesDir, storedName), body);

    sendJSON(res, 201, {
      url: `${this.baseUrl}/files/${encodeURIComponent(storedName)}`,
      name: storedName
    });
  }

  serve(res: http.ServerResponse, name: string): void {
    const stored = this.resolveStored(name);
    if (!fs.existsSync(stored)) throw new HttpError(404, 'File not found.', 153);

    const data = fs.readFileSync(stored);
    const contentType = EXT_CONTENT_TYPES[path.extname(stored).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length, ...CORS_HEADERS });
    res.end(data);
  }

  delete(res: http.ServerResponse, name: string): void {
    const stored = this.resolveStored(name);
    if (fs.existsSync(stored)) fs.unlinkSync(stored);
    sendJSON(res, 200, {});
  }
}
