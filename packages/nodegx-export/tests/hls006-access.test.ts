/**
 * HLS-006 — the access policy, case by case.
 *
 * This is the exhaustive half. `hls006-serve.test.ts` drives the same decisions through real
 * sockets; this one enumerates the cases a socket cannot reach on a machine with no network, and
 * the ones that only exist as an argument somebody might pass by accident.
 *
 * 🔴 **The population that matters here is "every way a caller could end up off loopback".**
 * A spec that only asserts `resolveAccess({}).host === '127.0.0.1'` grades the case nobody was
 * ever going to get wrong. The defect this file exists for is a `host` arriving from somewhere
 * that did not decide anything — a config file, an environment variable, a forwarded option —
 * which is precisely how `.listen(port)` came to bind `::`.
 */
import {
  ALL_INTERFACES,
  LOOPBACK,
  TOKEN_COOKIE,
  TOKEN_HEADER,
  TOKEN_QUERY,
  authoriseRequest,
  describeAccess,
  isLoopbackAddress,
  mintToken,
  resolveAccess,
  shareUrl,
  tokenFromRequest,
  tokenMatches
} from '../src/serve/access';

describe('the binding', () => {
  it('is loopback when nothing was asked for', () => {
    expect(resolveAccess().host).toBe(LOOPBACK);
    expect(resolveAccess({}).host).toBe(LOOPBACK);
    expect(resolveAccess().shared).toBe(false);
  });

  /**
   * 🔴 The one with teeth. Each of these is a plausible way for an address to arrive without
   * anybody having decided to share, and every one of them must still be loopback.
   */
  it.each([
    ['a host with no share', { host: ALL_INTERFACES }],
    ['the dual-stack wildcard', { host: '::' }],
    ['a specific LAN address', { host: '192.168.1.50' }],
    ['an empty host', { host: '' }],
    ['share explicitly false, host set', { share: false, host: ALL_INTERFACES }],
    ['a token but no share', { token: 'supplied', host: ALL_INTERFACES }]
  ])('stays on loopback for %s', (_name, request) => {
    const access = resolveAccess(request as Parameters<typeof resolveAccess>[0]);
    expect(access.host).toBe(LOOPBACK);
    expect(access.shared).toBe(false);
  });

  it('binds every interface only when sharing was decided', () => {
    expect(resolveAccess({ share: true }).host).toBe(ALL_INTERFACES);
    expect(resolveAccess({ share: true }).shared).toBe(true);
    expect(resolveAccess({ share: true, host: '192.168.1.50' }).host).toBe('192.168.1.50');
  });

  it('never produces a share without a token', () => {
    const access = resolveAccess({ share: true });
    expect(access.token).toMatch(/^[0-9a-f]{64}$/);
    // …and an unshared one has one too, so turning sharing on later cannot find itself without a
    // credential and invent a weaker path.
    expect(resolveAccess().token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mints a different token every time', () => {
    expect(mintToken()).not.toBe(mintToken());
  });

  it('uses a supplied token, so a pipeline can know it before the server runs', () => {
    expect(resolveAccess({ share: true, token: 'known-in-advance' }).token).toBe('known-in-advance');
  });
});

describe('who counts as this machine', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.0.0.53', '127.1.2.3'])('%s is loopback', (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  /**
   * ⚠️ `::ffff:192.168.1.9` is the one that decides whether this function is a check or a
   * decoration: it is what a dual-stack socket reports for an ordinary IPv4 peer, it *starts*
   * with a v6 prefix, and a naive "does it look like v6" test would call it loopback and exempt
   * the entire LAN from the token.
   */
  it.each(['192.168.1.9', '::ffff:192.168.1.9', '10.0.0.4', '8.8.8.8', '2001:db8::1', '0.0.0.0', '', undefined])(
    '%s is not',
    (address) => {
      expect(isLoopbackAddress(address as string | undefined)).toBe(false);
    }
  );
});

describe('reading the token off a request', () => {
  const token = 'the-token';

  it('takes it from the query string', () => {
    expect(tokenFromRequest({ url: `/?${TOKEN_QUERY}=${token}` })).toBe(token);
    expect(tokenFromRequest({ url: `/some/page?other=1&${TOKEN_QUERY}=${token}` })).toBe(token);
  });

  it('takes it from the header, the bearer and the cookie', () => {
    expect(tokenFromRequest({ headers: { [TOKEN_HEADER]: token } })).toBe(token);
    expect(tokenFromRequest({ headers: { authorization: `Bearer ${token}` } })).toBe(token);
    expect(tokenFromRequest({ headers: { cookie: `a=1; ${TOKEN_COOKIE}=${token}; b=2` } })).toBe(token);
  });

  it('is null when nothing carries one', () => {
    expect(tokenFromRequest({ url: '/', headers: {} })).toBeNull();
    expect(tokenFromRequest({ url: `/?${TOKEN_QUERY}=`, headers: {} })).toBeNull();
    expect(tokenFromRequest({})).toBeNull();
  });

  it('does not throw on a URL that is not one', () => {
    expect(() => tokenFromRequest({ url: '//%%' })).not.toThrow();
  });
});

describe('the comparison', () => {
  it('accepts only the exact token', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abd', 'abc')).toBe(false);
    // A prefix and an extension both have the wrong length, which is the check done first and
    // deliberately — `timingSafeEqual` throws on a length mismatch and the throw leaks the length.
    expect(tokenMatches('ab', 'abc')).toBe(false);
    expect(tokenMatches('abcd', 'abc')).toBe(false);
  });

  it('refuses the shapes that are not a token at all', () => {
    expect(tokenMatches(undefined, 'abc')).toBe(false);
    expect(tokenMatches(null, 'abc')).toBe(false);
    expect(tokenMatches(42, 'abc')).toBe(false);
    expect(tokenMatches({ toString: () => 'abc' }, 'abc')).toBe(false);
    // 🔴 An empty configured token must not turn into "everything matches".
    expect(tokenMatches('', '')).toBe(false);
  });
});

describe('the gate', () => {
  const shared = resolveAccess({ share: true, token: 'the-token' });
  const local = resolveAccess({ token: 'the-token' });

  it('lets a loopback caller through, shared or not', () => {
    expect(authoriseRequest({ url: '/', remoteAddress: '127.0.0.1' }, local).ok).toBe(true);
    expect(authoriseRequest({ url: '/', remoteAddress: '127.0.0.1' }, shared).ok).toBe(true);
    expect(authoriseRequest({ url: '/', remoteAddress: '::ffff:127.0.0.1' }, shared).ok).toBe(true);
  });

  /**
   * 🔴 The three verdicts asserted together, which is the acceptance criterion's own wording:
   * a refusal read on its own says nothing, because a server that is simply broken refuses
   * everything and looks exactly like this.
   */
  it('refuses a remote caller with no token and with a wrong one, and admits the right one', () => {
    const noToken = authoriseRequest({ url: '/', remoteAddress: '192.168.1.9' }, shared);
    const wrongToken = authoriseRequest({ url: '/?t=nope', remoteAddress: '192.168.1.9' }, shared);
    const rightToken = authoriseRequest({ url: '/?t=the-token', remoteAddress: '192.168.1.9' }, shared);

    expect(noToken.ok).toBe(false);
    expect(wrongToken.ok).toBe(false);
    expect(rightToken.ok).toBe(true);

    expect(noToken.ok === false && noToken.reason).toBe('no-token');
    expect(wrongToken.ok === false && wrongToken.reason).toBe('wrong-token');
    // ⚠️ Two reasons, one response. The distinction is for the log; telling the client which one
    // it was is how a scanner learns the parameter name is right.
    expect(noToken.ok === false && noToken.status).toBe(401);
    expect(wrongToken.ok === false && wrongToken.status).toBe(401);
    expect(noToken.ok === false && noToken.body).toBe(wrongToken.ok === false && wrongToken.body);
  });

  it('hands an accepted token back as a cookie, so the assets the page loads are not all 401s', () => {
    const verdict = authoriseRequest({ url: '/?t=the-token', remoteAddress: '192.168.1.9' }, shared);
    expect(verdict.ok === true && verdict.setCookie).toContain(`${TOKEN_COOKIE}=the-token`);
    expect(verdict.ok === true && verdict.setCookie).toContain('HttpOnly');
    expect(verdict.ok === true && verdict.setCookie).toContain('SameSite=Strict');
    // A loopback caller is not issued one: nothing is ever going to check it.
    const localVerdict = authoriseRequest({ url: '/', remoteAddress: '127.0.0.1' }, shared);
    expect(localVerdict.ok === true && localVerdict.setCookie).toBeNull();
  });

  it('says nothing useful to whoever was refused', () => {
    const refused = authoriseRequest({ url: '/', remoteAddress: '192.168.1.9' }, shared);
    const body = refused.ok === false ? refused.body : '';
    expect(body).not.toContain('the-token');
    expect(body).not.toMatch(/wrong|invalid|incorrect|missing/i);
    // It does say what to do, because the likeliest reader is a colleague holding half a link.
    expect(body).toContain('?t=');
  });
});

describe('what it says out loud', () => {
  it('states the loopback case as a fact about the network, not as a setting', () => {
    const text = describeAccess(resolveAccess(), 8574);
    expect(text).toContain('127.0.0.1:8574');
    expect(text).toContain('this machine only');
  });

  it('puts the token in the URL it prints, because the link is the credential', () => {
    const access = resolveAccess({ share: true, token: 'the-token' });
    const text = describeAccess(access, 8574, '192.168.1.9');
    expect(text).toContain(shareUrl('192.168.1.9', 8574, 'the-token'));
    expect(text).toContain('the-token');
  });

  it('escapes a token that would otherwise break the URL it is put in', () => {
    expect(shareUrl('h', 1, 'a b&c=d')).toBe('http://h:1/?t=a%20b%26c%3Dd');
  });
});
