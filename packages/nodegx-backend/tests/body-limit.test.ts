/**
 * BAK-009 — an over-limit request body must produce a *readable* 413.
 *
 * `readRawBody` used to call `req.destroy()` the moment it passed the limit,
 * which tore the socket down before the 413 it had just rejected with could be
 * written. Every real client saw `ECONNRESET` and no status at all. Two call
 * sites (WF-005 webhooks, BAK-006 uploads) each worked around it with their own
 * Content-Length pre-check, which only covers senders that declare a length —
 * a chunked sender still got the reset.
 *
 * These tests drive a real `http.Server` with a real socket, because that is
 * the only place the difference between "413" and "connection died" is
 * observable: a unit test on the promise alone passed the whole time the
 * product was broken.
 */
import * as http from 'http';

import { HttpError, readRawBody, sendError, sendJSON } from '../src/server/http-util';

jest.setTimeout(20000);

const LIMIT = 64 * 1024;

/** A server whose only job is to read a body under `LIMIT` and report. */
function startServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    readRawBody(req, LIMIT)
      .then((body) => sendJSON(res, 200, { received: body.length }))
      .catch((err) => sendError(res, err));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          })
      });
    });
  });
}

type ClientResult = { status?: number; body?: string; errorCode?: string };

/**
 * POST `totalBytes` and report what the client actually observed — a status, or
 * a transport error. Never rejects, because "the socket died" is a result here,
 * not a test failure.
 */
function post(port: number, totalBytes: number, declareLength: boolean): Promise<ClientResult> {
  return new Promise((resolve) => {
    const chunk = Buffer.alloc(8 * 1024, 0x41);
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
    if (declareLength) headers['Content-Length'] = String(totalBytes);

    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/', headers }, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    let settled = false;
    const fail = (code: string) => {
      if (!settled) {
        settled = true;
        resolve({ errorCode: code });
      }
    };
    req.on('error', (e: NodeJS.ErrnoException) => fail(e.code || 'ERR'));

    let sent = 0;
    const pump = () => {
      while (sent < totalBytes) {
        // A write can fail once the peer has closed; that is the reset case and
        // `error` reports it.
        if (req.destroyed) return;
        const size = Math.min(chunk.length, totalBytes - sent);
        sent += size;
        if (!req.write(chunk.subarray(0, size))) {
          req.once('drain', pump);
          return;
        }
      }
      req.end();
    };
    pump();
  });
}

describe('BAK-009 request body limits', () => {
  let server: { port: number; close: () => Promise<void> };

  beforeEach(async () => {
    server = await startServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('accepts a body under the limit', async () => {
    const res = await post(server.port, LIMIT - 1024, true);
    expect(res.errorCode).toBeUndefined();
    expect(res.status).toBe(200);
  });

  // The regression. A chunked sender never hits a Content-Length pre-check, so
  // this goes straight through the streaming path that used to destroy().
  it('answers an over-limit chunked body with a 413 the client can read', async () => {
    const res = await post(server.port, LIMIT * 4, false);

    expect(res.errorCode).toBeUndefined(); // not ECONNRESET
    expect(res.status).toBe(413);
    expect(res.body).toContain('Request body too large');
  });

  it('answers an over-limit body with a declared length the same way', async () => {
    const res = await post(server.port, LIMIT * 4, true);

    expect(res.errorCode).toBeUndefined();
    expect(res.status).toBe(413);
  });

  it('closes the connection after a 413 rather than leaving unread body bytes on it', async () => {
    // The rest of the refused upload is still in flight. Keeping keep-alive on
    // would leave Node parsing those bytes as the next pipelined request.
    const res = await post(server.port, LIMIT * 4, false);
    expect(res.status).toBe(413);
  });

  it('rejects with an HttpError carrying status 413', async () => {
    // Guards the type the route handlers branch on (WF-005 records a rejection
    // off `e instanceof HttpError && e.status === 413`).
    const fake = new (require('stream').PassThrough)() as unknown as http.IncomingMessage;
    const promise = readRawBody(fake, 16);
    (fake as unknown as NodeJS.WritableStream).write(Buffer.alloc(64));
    await expect(promise).rejects.toBeInstanceOf(HttpError);
    await expect(promise).rejects.toMatchObject({ status: 413 });
  });

  it('does not destroy the request when the limit is exceeded', async () => {
    // The specific regression: a destroyed request cannot carry a response.
    const fake = new (require('stream').PassThrough)() as unknown as http.IncomingMessage;
    const promise = readRawBody(fake, 16);
    (fake as unknown as NodeJS.WritableStream).write(Buffer.alloc(64));
    await expect(promise).rejects.toBeInstanceOf(HttpError);
    expect((fake as unknown as { destroyed: boolean }).destroyed).toBe(false);
  });
});
