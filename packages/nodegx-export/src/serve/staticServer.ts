/**
 * HLS-006 — the server behind `nodegx serve`.
 *
 * ## What it serves, and why that is a built export rather than a project
 *
 * [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) asks for
 * `nodegx serve <project> --host --token`, and the honest version of that in *this* package is
 * one step further along the pipeline. `@nodegx/export` turns a project into **React source**;
 * looking at it requires `npm install && npm run build` first. A `serve` that took a project folder
 * would either have to carry the editor's runtime — which is what `@noodl/preview` does, and it
 * reaches into `noodl-editor` in eleven places to do it, so it cannot be what a published
 * package offers — or silently serve something that is not the app.
 *
 * So this serves a directory of built files, and the pipeline it completes is the phase's own
 * person sentence: `nodegx export`, then `npm install && npm run build`, then `nodegx serve dist`.
 * A folder that is a project rather than a build is **refused with the two commands that are
 * missing**, not served empty — see {@link describeTarget}.
 *
 * ## The access policy is not implemented here
 *
 * Every decision about the address and the token is `serve/access.ts`, which the editor's
 * `web-server.js` also calls. That is deliberate and is the trap HLS-006 names: two servers with
 * two policies drift, and a security default is the worst place for it to happen.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

import { type Access, authoriseRequest } from './access';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8'
};

/** Whether this folder is something to serve, phrased as what to do about it if not. */
export function describeTarget(dir: string): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(dir)) return { ok: false, reason: `There is no folder at ${dir}.` };
  if (!fs.statSync(dir).isDirectory()) return { ok: false, reason: `${dir} is a file, not a folder.` };
  if (fs.existsSync(path.join(dir, 'index.html'))) return { ok: true };

  // The two folders somebody is most likely to point this at by mistake are the project and the
  // export, and each has a specific next command. Saying "no index.html" instead would be true
  // and would leave them to work out which of the two situations they are in.
  if (fs.existsSync(path.join(dir, 'nodegx.project.json'))) {
    return {
      ok: false,
      reason:
        `${dir} is a NodeGX project, not a built site. A project has to be exported and built ` +
        'before it can be served:\n' +
        `  nodegx export ${dir} ./exported\n` +
        '  cd exported && npm install && npm run build\n' +
        '  nodegx serve ./exported/dist\n'
    };
  }
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    return {
      ok: false,
      reason:
        `${dir} is an exported app that has not been built yet — it holds React source, which a ` +
        'browser cannot run. Build it first:\n' +
        `  cd ${dir} && npm install && npm run build\n` +
        `  nodegx serve ${path.join(dir, 'dist')}\n`
    };
  }
  return { ok: false, reason: `${dir} holds no index.html, so there is nothing here to serve.` };
}

/**
 * Resolve a request path to a file inside `root`, or `null`.
 *
 * 🔴 **The containment check is on the resolved path, not on the request string.** Rejecting
 * `..` in the URL is the check that looks right and is not: `%2e%2e%2f` does not contain `..`
 * until it has been decoded, and by then the string being inspected is not the one that will be
 * opened. `path.resolve` then a prefix test is a check on the thing that actually gets read.
 */
export function resolveFile(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null; // A malformed escape is not a path.
  }
  if (decoded.indexOf('\0') !== -1) return null;

  const resolved = path.resolve(root, '.' + path.posix.normalize(decoded));
  // `root + path.sep` rather than `root`, or `/tmp/site-secrets` passes a prefix test for `/tmp/site`.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const index = path.join(resolved, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(resolved) ? resolved : null;
}

export interface StaticServerOptions {
  root: string;
  port: number;
  access: Access;
  /** Serve `index.html` for a path that matches no file — what a client-side router needs. */
  spa?: boolean;
}

/**
 * Build the server. Does not listen: the caller does, so that it can bind
 * {@link Access.host} and read the address back off the socket afterwards — which is what
 * HLS-006 AC2 grades, and it cannot be graded through an option that was passed in.
 */
export function createStaticServer(options: StaticServerOptions): http.Server {
  const root = path.resolve(options.root);
  const spa = options.spa !== false;

  return http.createServer((request, response) => {
    const verdict = authoriseRequest(
      { url: request.url, headers: request.headers, remoteAddress: request.socket.remoteAddress },
      options.access
    );
    if (verdict.ok === false) {
      response.writeHead(verdict.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(verdict.body);
      return;
    }
    if (verdict.setCookie) response.setHeader('Set-Cookie', verdict.setCookie);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      response.end('This server only reads files.\n');
      return;
    }

    const urlPath = (request.url || '/').split('?')[0];
    let file = resolveFile(root, urlPath);
    if (file === null && spa && path.extname(urlPath) === '') {
      const index = path.join(root, 'index.html');
      if (fs.existsSync(index)) file = index;
    }

    if (file === null) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found\n');
      return;
    }

    response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on('error', () => {
      response.end();
    });
    stream.pipe(response);
  });
}
