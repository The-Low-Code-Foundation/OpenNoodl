/**
 * A real OpenID Connect provider, on localhost, for BAK-004's tests.
 *
 * The task's success criteria name Keycloak. A Keycloak container is not
 * something a unit suite can depend on, and mocking the provider would test the
 * mock rather than the code: the interesting parts of this feature are the
 * discovery document, the PKCE round-trip and the ID-token SIGNATURE, all of
 * which vanish the moment they are stubbed.
 *
 * So this is an actual HTTP server speaking actual OIDC with an actual RSA (or
 * EC) keypair: `/.well-known/openid-configuration`, `/jwks`, `/authorize`,
 * `/token`. The backend under test reaches it over a real socket and verifies a
 * real signature against a real published key. What it does NOT reproduce is a
 * provider's consent UI, which is the one part the backend never sees.
 *
 * It is also the attacker's toolkit: it can mint a token with the wrong
 * audience, the wrong issuer, a bad nonce, `alg: none`, or a signature from a
 * key it never published — which is how the verification tests prove the
 * checks are load-bearing rather than decorative.
 */

import * as crypto from 'crypto';
import * as http from 'http';

export interface MintOptions {
  sub?: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string;
  /** Override the audience — the "minted for another client" attack. */
  aud?: string | string[];
  azp?: string;
  /** Override the issuer — the "token from somewhere else" attack. */
  iss?: string;
  /** Override the nonce — the "replayed from another flow" attack. */
  nonce?: string;
  /** Seconds from now. Negative mints an already-expired token. */
  expiresInSeconds?: number;
  /** Sign with a key the JWKS does not publish. */
  signWithForeignKey?: boolean;
  /** Emit `alg: none` with an empty signature. */
  algNone?: boolean;
  /** Claim an algorithm this backend refuses. */
  forceAlg?: string;
  /** Emit a `kid` that is not in the JWKS. */
  forceKid?: string;
}

interface PendingAuthorization {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
  sub: string;
}

export class FakeOidcProvider {
  private server: http.Server | null = null;
  private readonly keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly foreignKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly kid = 'test-key-1';
  private readonly codes = new Map<string, PendingAuthorization>();

  /** Set once listening. */
  issuer = '';

  readonly clientId = 'test-client-id';
  readonly clientSecret = 'test-client-secret';

  /** What the next `/token` call should claim about the user. Tests set this. */
  nextIdentity: { sub: string; email: string | null; emailVerified: boolean; name?: string } = {
    sub: 'provider-subject-1',
    email: 'user@example.com',
    emailVerified: true
  };

  /** Fault injection applied to the NEXT minted ID token, then cleared. */
  nextMintOptions: MintOptions | null = null;

  /** Set to make `/token` answer an OAuth error instead. */
  nextTokenError: string | null = null;

  async start(): Promise<string> {
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', () => resolve()));
    const address = this.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    this.issuer = `http://127.0.0.1:${port}`;
    return this.issuer;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  /** The published JWKS entry — the only key a well-behaved verifier will accept. */
  private jwk(): crypto.JsonWebKey {
    return { ...this.keyPair.publicKey.export({ format: 'jwk' }), kid: this.kid, alg: 'RS256', use: 'sig' };
  }

  /**
   * Stand in for the user pressing "Allow": register an authorization and hand
   * back the code the provider would have redirected with. Tests call this
   * instead of driving a consent page that does not exist.
   */
  authorize(authorizationUrl: string, sub?: string): string {
    const url = new URL(authorizationUrl);
    const code = crypto.randomBytes(12).toString('hex');
    this.codes.set(code, {
      clientId: url.searchParams.get('client_id') || '',
      redirectUri: url.searchParams.get('redirect_uri') || '',
      codeChallenge: url.searchParams.get('code_challenge') || '',
      nonce: url.searchParams.get('nonce') || '',
      sub: sub || this.nextIdentity.sub
    });
    return code;
  }

  private mintIdToken(pending: PendingAuthorization): string {
    const options = this.nextMintOptions || {};
    this.nextMintOptions = null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header: Record<string, unknown> = options.algNone
      ? { alg: 'none', typ: 'JWT' }
      : { alg: options.forceAlg || 'RS256', typ: 'JWT', kid: options.forceKid || this.kid };

    const payload: Record<string, unknown> = {
      iss: options.iss !== undefined ? options.iss : this.issuer,
      sub: options.sub || pending.sub,
      aud: options.aud !== undefined ? options.aud : this.clientId,
      exp: nowSeconds + (options.expiresInSeconds !== undefined ? options.expiresInSeconds : 300),
      iat: nowSeconds,
      nonce: options.nonce !== undefined ? options.nonce : pending.nonce,
      email: options.email !== undefined ? options.email : this.nextIdentity.email,
      email_verified: options.emailVerified !== undefined ? options.emailVerified : this.nextIdentity.emailVerified,
      ...(options.azp ? { azp: options.azp } : {}),
      ...(options.name || this.nextIdentity.name ? { name: options.name || this.nextIdentity.name } : {})
    };
    if (payload.email === null) delete payload.email;

    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const signingInput = `${encode(header)}.${encode(payload)}`;

    if (options.algNone) return `${signingInput}.`;

    const key = options.signWithForeignKey ? this.foreignKeyPair.privateKey : this.keyPair.privateKey;
    const signature = crypto.sign('sha256', Buffer.from(signingInput, 'ascii'), key);
    return `${signingInput}.${signature.toString('base64url')}`;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', this.issuer || 'http://127.0.0.1');
    const json = (status: number, body: unknown) => {
      const text = JSON.stringify(body);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
      res.end(text);
    };

    if (url.pathname === '/.well-known/openid-configuration') {
      json(200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256']
      });
      return;
    }

    if (url.pathname === '/jwks') {
      json(200, { keys: [this.jwk()] });
      return;
    }

    if (url.pathname === '/token' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf-8'));

      if (this.nextTokenError) {
        const error = this.nextTokenError;
        this.nextTokenError = null;
        json(400, { error });
        return;
      }

      const code = form.get('code') || '';
      const pending = this.codes.get(code);
      if (!pending) {
        json(400, { error: 'invalid_grant' });
        return;
      }
      this.codes.delete(code); // authorization codes are single-use, as in real life

      if (form.get('client_secret') !== this.clientSecret) {
        json(401, { error: 'invalid_client' });
        return;
      }
      // Verify PKCE for real — this is what proves the backend sent a matching
      // verifier rather than sending a challenge nobody ever checks.
      const verifier = form.get('code_verifier') || '';
      const expected = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
      if (!verifier || expected !== pending.codeChallenge) {
        json(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
        return;
      }
      if (form.get('redirect_uri') !== pending.redirectUri) {
        json(400, { error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
        return;
      }

      json(200, {
        access_token: 'fake-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: this.mintIdToken(pending)
      });
      return;
    }

    json(404, { error: 'not_found' });
  }
}
