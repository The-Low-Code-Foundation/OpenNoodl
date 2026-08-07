/**
 * The handful of HTML pages this API serves to a browser.
 *
 * Almost everything here answers JSON, but three flows end in a browser looking
 * at a URL the service produced: BAK-002's password-reset form and verification
 * result, and BAK-004's sign-in failures (a callback that cannot be completed
 * has nowhere to redirect to, so it has to say so on a page).
 *
 * One place, so the escaping is written once and the pages look like each
 * other. Deliberately unstyled beyond legibility — these are terminal states in
 * an auth flow, not product surface, and every byte here ships in the bundle.
 *
 * @module nodegx-backend/server/mini-page
 */

import type * as http from 'http';

const STYLE =
  'body{font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:420px;margin:64px auto;' +
  'padding:0 16px;color:#1a1a1a}input{width:100%;box-sizing:border-box;padding:8px;margin:6px 0 14px;' +
  'font-size:14px}button{padding:8px 16px;font-size:14px;cursor:pointer}.err{color:#a12}.ok{color:#173}';

export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/** A complete, self-contained document. */
export function page(title: string, body: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<style>${STYLE}</style>` +
    `</head><body>${body}</body></html>`
  );
}

export function sendHTML(res: http.ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
  res.end(html);
}

/**
 * The standard "this didn't work" terminal page. `detail` is escaped — some of
 * these messages carry values that came in over the wire.
 */
export function sendErrorPage(res: http.ServerResponse, status: number, heading: string, detail: string): void {
  sendHTML(res, status, page(heading, `<h2 class="err">${escapeHtml(heading)}</h2><p>${escapeHtml(detail)}</p>`));
}
