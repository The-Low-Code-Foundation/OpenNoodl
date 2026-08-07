/**
 * OBS-004 — the relay's shared secret.
 *
 * ⚠️ **WHY THIS EXISTS.** Port 8574 is the editor↔preview WebSocket relay. It is product
 * infrastructure, not dev tooling: it serves the preview, so it runs in the packaged app, on
 * every user's machine, whenever the editor is open. Until this file it accepted **any**
 * connection and fanned every message to the opposite peer type.
 *
 * That was obscure-but-open, and two things closed the gap between obscure and exploitable:
 *
 *  1. **Browsers do not apply the same-origin policy to WebSockets.** Any page the user visits
 *     can `new WebSocket('ws://localhost:8574')`, register as an `editor` peer, and receive the
 *     whole stream — the project export, every traced value, every warning. No prompt, no CORS
 *     preflight, nothing to notice.
 *  2. **OBS-004 documents the relay as an integration point and adds input injection**, so a
 *     peer that can reach it can now also drive the user's running app.
 *
 * A token turns "anything that can open a socket" into "anything that can read a file in the
 * user's own application-support directory", which is the ordinary local-tooling bar (the same
 * one `git credential`, Docker's socket and the Chrome DevTools protocol's target list sit at).
 * It is not protection against a process already running as the user — nothing local can be.
 *
 * ## The contract
 *
 * - Minted once per app launch, in memory. First caller wins; there is no ordering requirement
 *   between {@link getRelayToken} and `startServer`, which matters because `createWindow()`
 *   runs *before* `startServer()` in `main.js` and the renderer therefore cannot inherit it
 *   through `process.env`.
 * - Written to `<userData>/relay-token` with mode `0600` so a local agent can read it. Rewritten
 *   every launch: a stale token in a file is worse than no file, because it authenticates a
 *   session that has ended.
 * - `process.env.NOODL_RELAY_TOKEN` is set as well, so anything the editor *spawns* inherits it
 *   without touching the file at all.
 *
 * ⚠️ **The token is not a password and must never be treated as one.** It is a per-launch
 * capability. It is not derived from anything the user knows, it is not stable across launches,
 * and it is deliberately readable by the user's own processes.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Basename under `userData`. Documented in the OBS-004 task file; agents read this path. */
const TOKEN_FILENAME = 'relay-token';

let cachedToken;

/**
 * The token for this app launch, minting it on first call.
 *
 * @param {{ getPath(name: string): string }} [app] Electron's `app`. Omitted in tests, where
 *   only the in-memory value matters and there is no userData directory to write to.
 * @returns {string} 64 hex characters.
 */
function getRelayToken(app) {
  if (cachedToken) return cachedToken;

  // An explicitly supplied token wins, so a harness driving a headless editor can know the
  // value up front rather than racing the file write.
  cachedToken = process.env.NOODL_RELAY_TOKEN || crypto.randomBytes(32).toString('hex');
  process.env.NOODL_RELAY_TOKEN = cachedToken;

  if (app && typeof app.getPath === 'function') {
    try {
      const file = path.join(app.getPath('userData'), TOKEN_FILENAME);
      // `mode` on `writeFileSync` only applies when the file is *created*, so an existing
      // file keeps whatever permissions it had. Truncate-and-chmod covers the upgrade case
      // where a previous launch wrote it before this line existed.
      fs.writeFileSync(file, cachedToken, { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(file, 0o600);
    } catch (e) {
      // A token that cannot be published is still a token: the editor and the preview both
      // receive it in-process. Only the external-agent path (OBS-004) is lost, and failing
      // the whole launch over it would be wildly disproportionate.
      console.log('Could not write the relay token file:', e.message);
    }
  }

  return cachedToken;
}

/**
 * Constant-time comparison.
 *
 * A `===` on a secret is a timing oracle in principle. It is a weak one here — the attacker
 * would need many thousands of local WebSocket handshakes to extract a byte, and the relay
 * closes the socket on the first failure — but the correct comparison costs one function call
 * and removes the argument entirely.
 */
function isValidRelayToken(candidate) {
  if (typeof candidate !== 'string' || !cachedToken) return false;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(cachedToken, 'utf8');
  // `timingSafeEqual` throws on a length mismatch, which would itself leak the length — so
  // the length check is done first and deliberately, rather than left to the exception.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Hand the served page the relay token.
 *
 * The viewer connects back to the origin it was loaded from, so the page itself is the only
 * distribution channel that works for every case at once: the editor's `<webview>`, a second
 * browser window the user opened by hand, and a phone on the LAN.
 *
 * ⚠️ Injected on the way out rather than into `index.html` on disk, deliberately. That file is
 * also the template a deployed export is built from, and a `{{#…#}}` placeholder left in it
 * would ship to production unreplaced. Doing the substitution here means the on-disk file
 * never mentions the token at all.
 *
 * ⚠️ Not readable cross-origin: `serveIndexFile` sends no `Access-Control-Allow-Origin`, so a
 * page on another origin cannot `fetch()` this HTML back out. (`serveFile` does send `*`,
 * which is why the token goes in the index and not in a static asset.)
 *
 * ⚠️ **`JSON.stringify` alone is not enough, and the HTML spec is the reason.** This is the
 * one place a value from outside the page becomes executable code inside it. `JSON.stringify`
 * is the obvious escaping and it does **not** escape `<`, so a token containing `</script>`
 * closes the tag from *inside* the string literal — the HTML tokenizer runs before the JS
 * parser ever sees the quotes. Escaping `<` to `\\u003C` is what actually closes that, and is
 * inert inside a JS string. U+2028/U+2029 are line terminators in JS but legal raw in JSON, so
 * they go the same way.
 *
 * The token is hex today. The injector must not depend on that, because the
 * `NOODL_RELAY_TOKEN` override lets a harness supply anything — and the whole point of a
 * credential path is that it stays correct when its input stops looking the way you expected.
 * Caught by `tests-main/relay-auth.test.js`, not by review.
 */
function injectRelayToken(html, token) {
  const ESCAPES = { '<': '\\u003C', '\u2028': '\\u2028', '\u2029': '\\u2029' };
  const literal = JSON.stringify(token).replace(/[<\u2028\u2029]/g, (c) => ESCAPES[c]);
  const script = `<script>window.__nodegxRelayToken=${literal};</script>`;
  // Falling back to a prepend rather than dropping the script keeps a hand-edited template
  // from silently breaking the preview.
  return html.includes('</head>') ? html.replace('</head>', script + '\n  </head>') : script + html;
}

/** Test seam. Never called in the app. */
function _resetRelayTokenForTests() {
  cachedToken = undefined;
  delete process.env.NOODL_RELAY_TOKEN;
}

module.exports = { getRelayToken, isValidRelayToken, injectRelayToken, TOKEN_FILENAME, _resetRelayTokenForTests };
