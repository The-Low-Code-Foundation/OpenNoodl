/**
 * Mock agent endpoint for the Agent Chat example project (AIX-005).
 *
 * Zero dependencies — plain `node:http`, `node:crypto` and a hand-rolled RFC 6455
 * frame codec, because the runtime's WebSocket node talks to whatever the browser
 * gives it and there is no WebSocket server in the standard library. Nothing here
 * is production code; it exists so the example can be run without an API key.
 *
 *   node mock-agent-server.mjs [port] [tokenDelayMs]
 *
 * Routes:
 *
 *   POST /chat/stream      text/event-stream. Streams a canned answer to
 *                          `{"prompt": "..."}` one token at a time, each event
 *                          carrying an `id:` so the stream is resumable and the
 *                          SSE node reports `at-least-once-deduped`. Ends the
 *                          response cleanly, which is what makes the node go to
 *                          `closed` instead of reconnecting for ever.
 *
 *   GET  /agent/actions    text/event-stream. Six action envelopes, chosen so the
 *                          Action Dispatcher's whole vocabulary of outcomes is
 *                          visible: two that execute, three refused for three
 *                          different reasons, and one that nothing handles (so it
 *                          parks on `waitingFor` before being refused).
 *
 *   GET  /                 plain-text index of the routes.
 *
 *   ws://…/live            A WebSocket that answers `ping` with `pong`, echoes
 *                          anything else, and pushes NDJSON bursts — two JSON
 *                          objects in ONE frame — so the JSON Stream Parser has
 *                          real message-boundary work to do and Stream Buffer has
 *                          something to coalesce.
 *
 * The SSE routes deliberately send CORS headers. The editor's preview serves the
 * app from its own origin, so every request to this mock is cross-origin; without
 * the preflight answer the browser blocks the POST before it is ever sent.
 */

import crypto from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.argv[2] || process.env.PORT || 4830);
const TOKEN_DELAY = Number(process.argv[3] || process.env.TOKEN_DELAY || 45);

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Last-Event-ID',
  'Access-Control-Max-Age': '600'
};

const log = (...args) => console.log('[mock-agent]', ...args);

// ---------------------------------------------------------------------------
// Server-sent events
// ---------------------------------------------------------------------------

function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...CORS
  });
}

/**
 * One SSE event. A payload containing newlines becomes several `data:` lines,
 * which the receiver rejoins with `\n` — that is how a token carrying a line
 * break survives a format whose field separator *is* the line break.
 */
function sendEvent(res, { id, event, data }) {
  let frame = '';
  if (id !== undefined) frame += `id: ${id}\n`;
  if (event !== undefined) frame += `event: ${event}\n`;
  for (const line of String(data).split('\n')) frame += `data: ${line}\n`;
  res.write(frame + '\n');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// /chat/stream
// ---------------------------------------------------------------------------

function cannedAnswer(prompt) {
  const asked = prompt ? `You asked: "${prompt}".\n\n` : '';
  return (
    asked +
    'Tokens arrive one at a time over a streamed POST, and the Text Accumulator ' +
    'joins them with an empty delimiter, so the Text node repaints as the answer ' +
    'is written rather than after it.\n\n' +
    'Here is a code block, so the Tools page has something to extract:\n\n' +
    '```js\n' +
    'const answer = tokens.reduce((all, next) => all + next, "");\n' +
    '```\n\n' +
    'Press Stop mid-answer to see cancellation, or stop this mock server ' +
    'mid-answer to watch the connection state go to reconnecting and back.'
  );
}

/** Splits into tokens that preserve every character, whitespace included. */
function tokenize(text) {
  return text.split(/(\s+)/).filter((piece) => piece !== '');
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) raw = raw.slice(0, 1e6);
    });
    req.on('end', () => resolve(raw));
  });
}

async function chatStream(req, res) {
  const raw = await readBody(req);
  let prompt = '';
  try {
    prompt = String(JSON.parse(raw || '{}').prompt || '');
  } catch {
    prompt = raw.slice(0, 200);
  }

  // A real endpoint would check this. This one only reports it, so the example can
  // show a POST with an Authorization header working without owning a secret.
  log(`POST /chat/stream prompt=${JSON.stringify(prompt.slice(0, 60))} auth=${req.headers.authorization || 'none'}`);

  openStream(res);

  const resumeFrom = Number(req.headers['last-event-id'] || 0);
  if (resumeFrom) log(`  resuming after event ${resumeFrom}`);

  const tokens = tokenize(cannedAnswer(prompt));
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  for (let i = 0; i < tokens.length; i++) {
    if (closed) {
      log('  client went away mid-answer');
      return;
    }
    if (i + 1 <= resumeFrom) continue;
    sendEvent(res, { id: i + 1, data: tokens[i] });
    await sleep(TOKEN_DELAY);
  }

  // A clean end. The SSE node's `reconnectOnStreamEnd` is false, so this becomes
  // `closed` + `onClose` rather than a reconnect that would regenerate the answer.
  res.end();
  log('  answer complete');
}

// ---------------------------------------------------------------------------
// /agent/actions
// ---------------------------------------------------------------------------

/**
 * Note the shape: the built-in store actions read `key` / `value` / `values` off
 * the envelope itself. Only a handler's payload comes from `payload`/`data`.
 */
const ACTIONS = [
  // Executes: SET_STORE is enabled by name on the dispatcher and `title` is in its
  // allowed keys.
  { type: 'SET_STORE', id: 'srv-1', key: 'title', value: 'Renamed by the server' },

  // Executes: an Action Handler in the graph registered SHOW_NOTICE. Its
  // registration IS its permission — delete the handler node and this is refused.
  { type: 'SHOW_NOTICE', id: 'srv-2', payload: 'This notice was sent by the server.' },

  // Refused, not-allowed: `messages` is outside the dispatcher's allowed keys.
  { type: 'SET_STORE', id: 'srv-3', key: 'messages', value: [] },

  // Refused, not-allowed: clearing would take out the keys the allow-list protects.
  { type: 'CLEAR_STORE', id: 'srv-4' },

  // Refused, invalid: no `type`.
  { id: 'srv-5', payload: 'nobody can tell what this is' },

  // Refused, unknown — but only after parking on `waitingFor` for the dispatcher's
  // wait window, in case a handler is still mounting. Everything behind it waits.
  { type: 'DELETE_EVERYTHING', id: 'srv-6' }
];

async function actionStream(req, res) {
  log('GET /agent/actions');
  openStream(res);

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  for (let i = 0; i < ACTIONS.length; i++) {
    if (closed) return;
    await sleep(600);
    sendEvent(res, { id: i + 1, data: JSON.stringify(ACTIONS[i]) });
    log(`  sent ${ACTIONS[i].type || '(no type)'}`);
  }

  await sleep(600);
  res.end();
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

function encodeFrame(body, opcode = 0x1) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Pulls whole frames out of an accumulating buffer. Returns the frames it could
 * complete and the bytes left over. Continuation frames are joined; a browser
 * will not fragment the small text frames this example sends, but a proxy may.
 */
function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let len = second & 0x7f;
    let cursor = offset + 2;

    if (len === 126) {
      if (cursor + 2 > buffer.length) break;
      len = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (len === 127) {
      if (cursor + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let mask;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + len > buffer.length) break;

    const payload = Buffer.from(buffer.subarray(cursor, cursor + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];

    frames.push({ fin, opcode, payload });
    offset = cursor + len;
  }

  return { frames, rest: buffer.subarray(offset) };
}

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key || !/\/live\/?$/.test(req.url.split('?')[0])) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);
  log('ws /live open');

  const send = (text) => {
    if (!socket.destroyed) socket.write(encodeFrame(text));
  };

  let buffer = Buffer.alloc(0);
  let fragments = [];

  // An NDJSON burst: two complete JSON objects in one frame. The JSON Stream
  // Parser has to find the boundary; the raw frame on its own is not valid JSON.
  let tick = 0;
  const burst = setInterval(() => {
    tick++;
    const a = JSON.stringify({ seq: tick * 2 - 1, kind: 'progress', pct: (tick * 7) % 100 });
    const b = JSON.stringify({ seq: tick * 2, kind: 'log', text: `step ${tick}` });
    send(a + '\n' + b + '\n');
  }, 400);

  const shutdown = (why) => {
    clearInterval(burst);
    if (!socket.destroyed) socket.end();
    log(`ws /live closed (${why})`);
  };

  send(JSON.stringify({ kind: 'hello', text: 'connected to the mock live stream' }) + '\n');

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const decoded = decodeFrames(buffer);
    buffer = decoded.rest;

    for (const frame of decoded.frames) {
      if (frame.opcode === 0x8) {
        // Close: echo the client's own status code and reason back, not an empty
        // frame — an empty echo makes the browser report 1005 ("no status"), which
        // would make the node's closeCode output useless for every clean close.
        if (!socket.destroyed) socket.write(encodeFrame(frame.payload, 0x8));
        shutdown('client closed');
        return;
      }
      if (frame.opcode === 0x9) {
        if (!socket.destroyed) socket.write(encodeFrame(frame.payload.toString('utf8'), 0xa));
        continue;
      }
      if (frame.opcode === 0xa) continue; // pong

      if (frame.opcode === 0x0) {
        fragments.push(frame.payload);
      } else {
        fragments = [frame.payload];
      }
      if (!frame.fin) continue;

      const text = Buffer.concat(fragments).toString('utf8');
      fragments = [];
      log(`ws /live recv ${JSON.stringify(text.slice(0, 80))}`);

      // The WebSocket node's heartbeat sends application data, because browsers
      // cannot send protocol ping frames. `heartbeatReply` is what it watches for,
      // and a reply that never comes closes and reconnects the socket.
      if (text === 'ping') {
        send('pong');
      } else if (text === 'bye') {
        // Send "bye" from the example to see a server-initiated close: 1001 is in
        // the retryable set, so the node reports the code and reason and then
        // reconnects with backoff.
        const payload = Buffer.alloc(2 + Buffer.byteLength('the mock said goodbye'));
        payload.writeUInt16BE(1001, 0);
        payload.write('the mock said goodbye', 2);
        if (!socket.destroyed) socket.write(encodeFrame(payload, 0x8));
        shutdown('server said goodbye');
        return;
      } else {
        send(JSON.stringify({ kind: 'echo', text }) + '\n');
      }
    }
  });

  socket.on('error', () => shutdown('socket error'));
  socket.on('close', () => shutdown('socket closed'));
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const INDEX = `Mock agent endpoint for the NodeGX Agent Chat example.

  POST /chat/stream     streamed answer (text/event-stream)
  GET  /agent/actions   action envelopes for the Action Dispatcher
  ws   /live            two-way stream with NDJSON bursts

Token delay ${TOKEN_DELAY}ms. Nothing here is authenticated; do not deploy it.
`;

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0].replace(/\/$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (pathname === '/chat/stream' && req.method === 'POST') return chatStream(req, res);
  if (pathname === '/agent/actions' && req.method === 'GET') return actionStream(req, res);

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS });
    res.end(INDEX);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS });
  res.end(`no mock route for ${req.method} ${pathname}\n`);
});

server.on('upgrade', handleUpgrade);

server.listen(PORT, () => {
  log(`listening on http://localhost:${PORT} (token delay ${TOKEN_DELAY}ms)`);
  log(`  POST http://localhost:${PORT}/chat/stream`);
  log(`  GET  http://localhost:${PORT}/agent/actions`);
  log(`  ws://localhost:${PORT}/live`);
});
