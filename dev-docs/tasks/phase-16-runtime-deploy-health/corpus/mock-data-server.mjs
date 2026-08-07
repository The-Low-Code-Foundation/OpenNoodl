/**
 * Mock data backend for the RUN-002 data-resolution probes
 * (probe-rest-data, probe-cloud-query). Zero dependencies.
 *
 * Serves, with deliberate latency (default 300 ms) so a render that does NOT
 * wait for data provably serves the placeholder text instead:
 *
 *   GET  /api/message         → { message: "HELLO_FROM_REST" }
 *        (probe-rest-data's REST2 node)
 *
 *   POST /classes/:collection → { results: [ ...records ] }
 *        Parse-style query as issued by cloudstore.js `query()` — the body
 *        carries { _method: "GET", where, ... }. On the SSR server this goes
 *        through XMLHttpRequest, NOT fetch, which is exactly what the
 *        render gate's XHR tracker exists to catch. (probe-cloud-query)
 *
 * Usage: node mock-data-server.mjs [port] [latencyMs]
 */
import http from 'http';

const PORT = Number(process.argv[2] || process.env.PORT || 4821);
const LATENCY = Number(process.argv[3] || process.env.LATENCY || 300);

const RECORDS = [
  { objectId: 'r1', title: 'ALPHA', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { objectId: 'r2', title: 'BETA', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { objectId: 'r3', title: 'GAMMA', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
];

// CORS is required: the hydration checks load the app from the SSR server's
// origin while this mock runs on its own port, and the browser-side data
// requests (REST2 uses XMLHttpRequest in the browser) are cross-origin.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Parse-Application-Id, X-Parse-Session-Token, X-Parse-Master-Key'
};

function respond(res, status, body) {
  setTimeout(() => {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(json);
  }, LATENCY);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`[mock-data] ${req.method} ${url.pathname}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (url.pathname === '/api/message') {
    respond(res, 200, { message: 'HELLO_FROM_REST' });
    return;
  }

  if (url.pathname.startsWith('/classes/')) {
    // Parse REST: query arrives as POST with {_method: "GET"}; plain GET also
    // supported for completeness. Any collection returns the fixed records.
    respond(res, 200, { results: RECORDS });
    return;
  }

  respond(res, 404, { error: `no mock route for ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`[mock-data] listening on ${PORT}, latency ${LATENCY}ms`);
});
