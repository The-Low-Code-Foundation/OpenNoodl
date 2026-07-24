/**
 * The preview server.
 *
 * Serves the same file set `deployToFolder` writes — the deployed runtime
 * bundle, `index.html` with the modules injected, `index.js` carrying
 * `window.projectData`, and `noodl_bundles/<id>.json` — except it holds the
 * generated parts in memory and swaps them atomically when the project changes.
 * Anything it does not recognise is served from the project directory, which is
 * how a real deploy resolves project assets (deployToFolder copies the project
 * folder alongside the runtime).
 *
 * Plus one route the deploy path has no equivalent of: `/__preview/events`, an
 * SSE channel the injected client listens on for reloads and diagnostics.
 *
 * @module noodl-preview/server
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import { bootstrapPage, injectClient } from './client';
import { DEPLOY_ASSETS, deployAssetPath, type PreviewBuild } from './loader';
import type { PreviewReport } from './validate';

/** What the server currently believes about the project on disk. */
export type PreviewState =
  | { kind: 'ok' }
  | { kind: 'invalid'; report: PreviewReport }
  | { kind: 'error'; message: string };

/**
 * The body of `GET /__preview/state` — the server's machine-readable status.
 * The CLI polls this in `--once` mode and the tests assert against it, so it is
 * a public contract rather than an implementation detail.
 */
export interface PreviewStatus {
  state: PreviewState;
  hasBuild: boolean;
  warnings: string[];
  projectDir: string;
}

/** One frame pushed down the SSE channel at `/__preview/events`. */
export type PreviewEvent =
  | { type: 'ok' }
  | { type: 'reload' }
  | { type: 'diagnostics'; diagnostics: PreviewReport['diagnostics']; summary: PreviewReport['summary'] }
  | { type: 'error'; message: string };

export interface PreviewServerOptions {
  projectDir: string;
  port: number;
  host?: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
};

const mimeFor = (file: string) => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

export class PreviewServer {
  private readonly server: http.Server;
  private readonly clients = new Set<http.ServerResponse>();
  private readonly projectDir: string;

  /** Last build that rendered. Kept across invalid states — that is the point. */
  private build: PreviewBuild | null = null;
  private state: PreviewState = { kind: 'error', message: 'Loading…' };
  private indexJs = '';

  constructor(private readonly options: PreviewServerOptions) {
    this.projectDir = path.resolve(options.projectDir);
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(String(err && err.stack ? err.stack : err));
      });
    });
  }

  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.options.port, this.options.host ?? '127.0.0.1', () => {
        const address = this.server.address();
        resolve(typeof address === 'object' && address ? address.port : this.options.port);
      });
    });
  }

  async close(): Promise<void> {
    for (const client of this.clients) client.end();
    this.clients.clear();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  /** Number of connected browsers — the CLI reports it, tests assert on it. */
  get clientCount(): number {
    return this.clients.size;
  }

  getState(): PreviewState {
    return this.state;
  }

  /** Installs a new good build and tells every browser to reload. */
  setBuild(build: PreviewBuild): void {
    this.build = build;
    this.indexJs = fs
      .readFileSync(deployAssetPath('index.js'), 'utf8')
      .replace(/{{#export#}}/g, JSON.stringify(build.exportJson));
    this.state = { kind: 'ok' };
    this.broadcast({ type: 'reload' });
  }

  /**
   * Reports a bad snapshot. The previous build stays installed so the browser
   * keeps rendering it underneath the overlay.
   */
  setInvalid(report: PreviewReport): void {
    this.state = { kind: 'invalid', report };
    this.broadcast({ type: 'diagnostics', diagnostics: report.diagnostics, summary: report.summary });
  }

  setError(message: string): void {
    this.state = { kind: 'error', message };
    this.broadcast({ type: 'error', message });
  }

  // ─── Wire ──────────────────────────────────────────────────────────────────

  private broadcast(message: PreviewEvent): void {
    const frame = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of this.clients) client.write(frame);
  }

  /** The frame a browser gets the moment it connects — never `reload`, which would loop. */
  private helloFrame(): PreviewEvent {
    switch (this.state.kind) {
      case 'invalid':
        return { type: 'diagnostics', diagnostics: this.state.report.diagnostics, summary: this.state.report.summary };
      case 'error':
        return { type: 'error', message: this.state.message };
      default:
        return { type: 'ok' };
    }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/__preview/events') return this.serveEvents(req, res);

    // Machine-readable status: what the CLI polls in --once mode and tests read.
    if (pathname === '/__preview/state') {
      const status: PreviewStatus = {
        state: this.state,
        hasBuild: this.build !== null,
        warnings: this.build?.warnings ?? [],
        projectDir: this.projectDir
      };
      return this.sendJson(res, status);
    }

    if (pathname === '/' || pathname === '/index.html') {
      const html = this.build ? injectClient(this.build.html) : bootstrapPage(path.basename(this.projectDir));
      return this.sendDynamic(res, html, 'text/html; charset=utf-8');
    }

    if (pathname === '/index.js') {
      if (!this.build) return this.notFound(res);
      return this.sendDynamic(res, this.indexJs, 'application/javascript; charset=utf-8');
    }

    if (pathname.startsWith('/noodl_bundles/')) {
      const id = path.basename(pathname, '.json');
      const bundle = this.build?.bundles[id];
      if (!bundle) return this.notFound(res);
      return this.sendDynamic(res, bundle, 'application/json; charset=utf-8');
    }

    const asset = pathname.slice(1);
    if (DEPLOY_ASSETS.includes(asset)) {
      return this.sendFile(req, res, deployAssetPath(asset));
    }

    // Everything else: a project asset (images, fonts, module files).
    const target = path.resolve(this.projectDir, `.${pathname}`);
    if (!target.startsWith(this.projectDir + path.sep)) return this.notFound(res);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return this.sendFile(req, res, target);
    }

    return this.notFound(res);
  }

  private serveEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      // Buffering proxies would defeat the whole channel.
      'x-accel-buffering': 'no'
    });
    res.write(`data: ${JSON.stringify(this.helloFrame())}\n\n`);

    this.clients.add(res);
    // Keep intermediaries (and some browsers) from timing the stream out.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
    });
  }

  private sendJson(res: http.ServerResponse, body: unknown): void {
    this.sendDynamic(res, JSON.stringify(body, null, 2), 'application/json; charset=utf-8');
  }

  /** Generated content: never cached, it changes on every edit. */
  private sendDynamic(res: http.ServerResponse, body: string, contentType: string): void {
    const buffer = Buffer.from(body, 'utf8');
    res.writeHead(200, {
      'content-type': contentType,
      'content-length': buffer.length,
      'cache-control': 'no-store'
    });
    res.end(buffer);
  }

  /**
   * Static content, revalidated by ETag. Matters more than it looks: the
   * deployed runtime bundle is ~5 MB and every reload re-requests it, so
   * without a 304 path "sub-second reload" would not hold.
   */
  private sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return this.notFound(res);
    }

    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': 'no-cache' });
      res.end();
      return;
    }

    res.writeHead(200, {
      'content-type': mimeFor(file),
      'content-length': stat.size,
      'cache-control': 'no-cache',
      etag
    });
    fs.createReadStream(file).pipe(res);
  }

  private notFound(res: http.ServerResponse): void {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('Not found');
  }
}
