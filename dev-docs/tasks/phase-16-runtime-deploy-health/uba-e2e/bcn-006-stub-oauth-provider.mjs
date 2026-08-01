/**
 * A stub OAuth2 / OIDC provider, so BCN-006 step 5 can be **measured** rather
 * than written from documentation.
 *
 * The rig has no OAuth provider configured on any backend — Directus reports
 * `GET /auth -> {"data":[]}` and PocketBase `oauth2.enabled: false` — so a
 * provider round-trip could not be observed at all. This is the smallest thing
 * that makes one observable: authorize → code → token → userinfo, no signing, no
 * discovery document, three endpoints.
 *
 * It is a **test fixture**, not a product component. It authenticates nobody and
 * accepts any client id.
 *
 *   node bcn-006-stub-oauth-provider.mjs [port]
 *
 * Endpoints:
 *   GET  /authorize  -> 302 {redirect_uri}?code=…&state=…
 *   POST /token      -> {access_token, token_type, expires_in}
 *   GET  /userinfo   -> {sub, email, email_verified, name}
 *   GET  /_issued    -> the codes issued so far (so a driver can assert on them)
 */

import http from 'node:http';
import crypto from 'node:crypto';

/** S256, so a wrong `code_verifier` is a real rejection rather than a shrug. */
function s256(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

const PORT = Number(process.argv[2] || 8113);

/** code -> {verifierChallenge, redirectUri, subject} */
const codes = new Map();
/** access token -> subject */
const tokens = new Map();
const issued = [];

let counter = 0;

function json(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  response.end(text);
}

function readBody(request) {
  return new Promise((resolve) => {
    let data = '';
    request.on('data', (chunk) => (data += chunk));
    request.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  if (url.pathname === '/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state') || '';
    if (!redirectUri) return json(response, 400, { error: 'invalid_request', error_description: 'redirect_uri is required' });

    counter += 1;
    const code = `bcn006b-code-${counter}`;
    const subject = `bcn006b-subject-${counter}`;
    codes.set(code, {
      challenge: url.searchParams.get('code_challenge'),
      redirectUri,
      subject
    });
    issued.push({ code, subject, state, redirectUri });

    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    response.writeHead(302, { Location: target.toString() });
    response.end();
    return;
  }

  if (url.pathname === '/token' && request.method === 'POST') {
    const raw = await readBody(request);
    const form = new URLSearchParams(raw);
    const code = form.get('code') || url.searchParams.get('code');
    const record = code ? codes.get(code) : undefined;
    if (!record) return json(response, 400, { error: 'invalid_grant', error_description: 'unknown or spent code' });
    codes.delete(code);

    // PKCE, actually checked. Without this a driver asserting "a wrong verifier
    // is rejected" would be asserting that this fixture is lenient.
    if (record.challenge) {
      const verifier = form.get('code_verifier');
      if (!verifier || s256(verifier) !== record.challenge) {
        return json(response, 400, { error: 'invalid_grant', error_description: 'code_verifier does not match code_challenge' });
      }
    }

    const accessToken = `bcn006b-access-${record.subject}`;
    tokens.set(accessToken, record.subject);
    return json(response, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile'
    });
  }

  if (url.pathname === '/userinfo') {
    const authorization = request.headers.authorization || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '');
    const subject = tokens.get(accessToken);
    if (!subject) return json(response, 401, { error: 'invalid_token' });
    return json(response, 200, {
      sub: subject,
      email: `${subject}@example.com`,
      email_verified: true,
      name: `BCN006b ${subject}`,
      preferred_username: subject
    });
  }

  if (url.pathname === '/_issued') return json(response, 200, { issued });

  json(response, 404, { error: 'not_found', path: url.pathname });
});

server.listen(PORT, () => {
  console.log(`stub oauth provider on http://localhost:${PORT}`);
});
